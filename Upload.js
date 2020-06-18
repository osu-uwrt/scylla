// Necessary imports 
var archiver = require("archiver"); // Needed to make .zip files
var orderBy = require("natural-orderby"); // Needed for "human" sorting 
var fs = require("fs"); // Needed for basically everything, we do a lot of file system work 
var path = require("path"); // Same reasoning as above 

var { updateStatus, clearDirectory, resolveBaseDir } = require("./Utility");

// Need an instance of client inside this "class" as well to do the uploading 
let client; 
module.exports.setClient = setClient; 
function setClient(pClient) {
  client = pClient; 
}

// This is kept over here so we don't have to worry about carrying it over
// This is the raw video names. No underscore replacement, just videoname.mp4 or similar. 
let videoNames = []; 
module.exports.appendToVideoNames = appendToVideoNames; 
function appendToVideoNames(videoName) {
  videoNames.push(videoName); 
}

// Important constants used in this class 
const BOX_OUTPUT_FOLDERID = "105343099285"; 
const OL_INPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "input");
const OL_OUTPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "output", "YOLO_darknet");

// Sequence of things that need to happen here: 
// For each video name: 
//   Figure out which frames are labeled. 
//   Get an array of full file paths that we need to zip together. 
//   Zip those files into a zip with the correct name, and save it to the filesystem. 
//   Upload that output to a specified box folder, creating a folder for that video if it doesn't already exist. 
module.exports.start = start; 
function start() {

  // Iterate through each video that we labeled
  videoNames.forEach(videoName => {

    let filesToUpload = [];
    let filesToUploadNames = [];

    //* Get a big list of all the files in the important I/O directories 
    let currentInputSubfolder = path.join(OL_INPUT_FOLDER, videoName.replace(".", "_"));
    let currentOutputSubfolder = path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"));
    let inputFiles = orderBy.orderBy(fs.readdirSync(currentInputSubfolder));
    let outputFiles = orderBy.orderBy(fs.readdirSync(currentOutputSubfolder));

    // Figure out which frames are labeled 
    let filledFrames = getFilledFrames(videoName); 
    console.log("filledFrames: ", filledFrames);

    // Loop through the frames in the video that we actually used 
    let currentFilledFramesIndex = 0; 
    while (currentFilledFramesIndex < filledFrames.length) {

      let currentStart = filledFrames[currentFilledFramesIndex]; 
      let currentEnd = filledFrames[currentFilledFramesIndex + 1]; 

      // Loop through the actual frames [start, end] from the original video 
      for (let currentFrameNumber = currentStart; currentFrameNumber <= currentEnd; currentFrameNumber++) {
        console.log("Adding file at path " + path.join(OL_INPUT_FOLDER, videoName.replace(".", "_"), inputFiles[currentFrameNumber]) + "to be uploaded.");
        filesToUpload = filesToUpload.concat(path.join(OL_INPUT_FOLDER, videoName.replace(".", "_"), inputFiles[currentFrameNumber]));
        filesToUploadNames = filesToUploadNames.concat(inputFiles[currentFrameNumber]);

        console.log("Adding file at path " + path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"), outputFiles[currentFrameNumber]) + "to be uploaded.");
        filesToUpload = filesToUpload.concat(path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"), outputFiles[currentFrameNumber]));
        filesToUploadNames = filesToUploadNames.concat(outputFiles[currentFrameNumber]);
      }

      // We iterate two at a time... One begin index and one end index
      currentFilledFramesIndex += 2; 
    }

    zipAndUploadFiles(filesToUpload, filesToUploadNames, filledFrames, videoName, "ZipFiles");
  });
}

async function zipAndUploadFiles(filesToUpload, filesToUploadNames, filledFrames, videoName, zipPath) {

  // If we didn't label anything in that file, get out of here 
  if (filesToUpload.length === 0) {
    return; 
  }

  console.log("videoName: " + videoName);
  console.log("filesToUpload: ", filesToUpload); 
  console.log("filesToUploadNames: ", filesToUploadNames);
  console.log("zipPath: " + zipPath);
  console.log("filledFrames: ", filledFrames); 

  // Essentially constructing the end name of the zip file from the filledFrames array
  // Need to name it this way so we can look at Box w/o downloading anything and figure out exactly what still needs boxed 
  var endZipUploadName = videoName.replace(".", "_"); 
  var endZipFilePath = path.join(zipPath, videoName.replace(".", "_")); 
  for (let i = 0; i < filledFrames.length; i++) {
    endZipFilePath += "_"; 
    endZipFilePath += filledFrames[i]; 
    endZipUploadName += "_"; 
    endZipUploadName += filledFrames[i]; 
  }
  endZipFilePath += ".zip"; 
  endZipUploadName += ".zip";

  console.log("Name of Zip We're Uploading: " + endZipUploadName);
  var output = fs.createWriteStream(endZipFilePath);
  var archive = archiver("zip", { zlib: { level: 9 } } );

  output.on("close", function() {
    console.log(archive.pointer() + " total bytes"); 
    console.log('archiver has been finalized and the output file descriptor has closed.');

    // Only clear the output directory after I make the .zip file
    // TODO: Should probably move the "clear my output directory" to when we initially open OpenLabeling, or make it when we initially open the directory 
    // clearDirectory(path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_")));

    // TODO: This just uploads everything we do here to a single folder, even if we just bboxed individual files. Have this automatically make folders for each video, putting the .zip in the correct folder. 
    // Actually upload the .zip file we just made
    console.log("About to upload zip of name " + endZipUploadName + " at path " + endZipFilePath);
    var stream = fs.createReadStream(endZipFilePath);
    client.files.uploadFile(BOX_OUTPUT_FOLDERID, endZipUploadName, stream)
    .then(file => {
      console.log("Finished uploading file ", file); 
    });
  }); 

  // good practice to catch this error explicitly
  archive.on('error', function(err) {
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);
  
  for (let i = 0; i < filesToUpload.length; i++) {
    archive.file(filesToUpload[i], { name: filesToUploadNames[i] });
  }

  archive.finalize();  
}

// Returns an array of format 
// [FirstFilledIntervalStart, FirstFilledIntervalEnd, SecondFilledIntervalStart, SecondFilledIntervalEnd, ...] 
// given an actual video name. All the file paths are Scylla-specific, basically. 
function getFilledFrames(videoName) {

  // Gets list of files in that video's output directory 
  var folder = path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"));
  console.log("getFilledFrames is looking at video in location " + path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_")));

  var frames = fs.readdirSync(folder);

  // Sorts the file names using Natural Sort, not Alphabetically 
  // Necessary so that it'll go Video1 -> Video 2 -> Video3 -> Video 22 rather than Video1 -> Video2 -> Video22 -> Video3. We want the first.
  frames = orderBy.orderBy(frames);

  // The thing we're returning, see description right above function for explanation 
  var framesArr = []; 

  // Note: OpenLabeling's output starts at index zero, so I'm using that convention 
  var currentlyActive = false; 
  var currentFileContents; 
  for (let i = 0; i < frames.length; i++) {

    currentFileContents = fs.readFileSync(path.join(folder, frames[i])); 
    // console.log("currentFileContents: ", currentFileContents);
    // console.log("Looking at file " + path.join(folder, frames[i]));
    
    // If we're currently on labeled frames, we look for one that ISN'T labeled and set the end of the interval to one before this 
    if (currentlyActive) {
      if (currentFileContents.length === 0) {
        // console.log("File is empty and is the first in series to NOT be bboxed!");
        framesArr.push(i - 1); 
        currentlyActive = false; 
      } else {
        // console.log("Current file was bboxed!");
      }
    }

    // Otherwise, we're currently on unlabeled frames, we look for one that IS labeled and set the beginning of next interval to current one 
    else {
      if (currentFileContents.length !== 0) {
        // console.log("File was bboxed and is the first in series TO be bboxed!");
        framesArr.push(i); 
        currentlyActive = true;
      } else {
        // console.log("File is empty.");
      }
    }
  }

  if (currentlyActive) {
    framesArr.push(frames.length - 1); 
  }

  return framesArr;
}