// Necessary imports 
var archiver = require("archiver"); // Needed to make .zip files
var orderBy = require("natural-orderby"); // Needed for "human" sorting 
var fs = require("fs"); // Needed for basically everything, we do a lot of file system work 
var path = require("path"); // Same reasoning as above 

// Need an instance of client inside this "class" as well to do the uploading 
let client; 
module.exports.getClient = getClient; 
function getClient(pClient) {
  client = pClient; 
}

// This is kept over here so we don't have to worry about carrying it over
// This is the raw video names. No underscore replacement, just videoname.mp4 or similar. 
let videoNames = []; 
module.exports.appendToVideoNames = appendToVideoNames; 
function appendToVideoNames(videoName) {
  videoNames.append(videoName); 
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

  // Iterate through each video 
  videoNames.forEach(videoName => {
    let filesToUpload = [];
    let filesToUploadNames = [];

    //* Get a big list of all the files in the important I/O directories 
    let currentInputSubfolder = path.join(OL_INPUT_FOLDER, videoName.replace(".", "_"));
    let currentOutputSubfolder = path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"));

    // Have to run these through "human" sorting; Alphabetical doesn't work right with numbers
    let inputFiles = orderBy.orderBy(fs.readdirSync(currentInputSubfolder));
    let outputFiles = orderBy.orderBy(fs.readdirSync(currentOutputSubfolder));

    // Figure out which frames are labeled 
    let filledFrames = getFilledFrames(videoName); 

    // TODO: This is really messy. Like, *super* messy. Clean it up. 

    // Because we essentially chop off filledFrames in practice, and we need to do it after, we put the values in another array too
    // Need to do a deep copy here b/c arrays are reference values and if we just use = it'll just alias to the same memory 
    let filledFramesBackup = []; 
    for (let j = 0; j < filledFrames.length; j++) {
      filledFramesBackup[j] = filledFrames[j]; 
    }
    console.log("filledFramesBackup: ", filledFramesBackup);

    console.log("filledFrames: ", filledFrames);

    // Go through this twice at a time until we get through all the filled frames
    let currentStart, currentEnd; 
    while (filledFrames.length > 0) {

      currentStart = filledFrames[0]; 
      currentEnd = filledFrames[1]; 

      // Loop through the actual frames [start, end] from the original video 
      for (let currentFrameNumber = currentStart; currentFrameNumber <= currentEnd; currentFrameNumber++) {

        console.log("Adding frame " + currentFrameNumber + " to filesToUpload and filesToUploadNames"); 

        filesToUpload = filesToUpload.concat(path.join(OL_INPUT_FOLDER, videoNames[i], inputFiles[currentFrameNumber]));
        filesToUploadNames = filesToUploadNames.concat(inputFiles[currentFrameNumber]);

        filesToUpload = filesToUpload.concat(path.join(OL_OUTPUT_FOLDER, videoNames[i], outputFiles[currentFrameNumber]));
        filesToUploadNames = filesToUploadNames.concat(outputFiles[currentFrameNumber]);
      }

      // Slice off the first two frames, because we just added both of those 
      // array.splice(index to remove at, # of elements to remove)
      filledFrames.splice(0, 2); 

      console.debug("filesToUpload: ", filesToUpload);
      console.debug("filesToUploadNames: ", filesToUploadNames);

      //* Zip everything in the array we just threw everything into 
      // The Zip file is VideoName_StartFrame_EndFrame
      // Not going to build in support for any non-contiguous boxing segments unless it becomes a problem...
      // In this case, I'll probalby make it VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2 and so on  
      // It'll be a miracle if any of this works 

      zipAndUploadFiles(filesToUpload, filesToUploadNames, filledFramesBackup, videoNames[i], "ZipFiles");
    }
  });
}

function getFilePathsToNonEmptyFiles(videoName, filledFrames) {

  console.debug("getFilePathsToNonEmptyFiles(): Entered function.");

  let videoSpecificInputDir = path.join(OL_INPUT_FOLDER, videoName.replace(".", "_"));
  let videoSpecificOutputDir = path.join(OL_OUTPUT_FOLDER, videoName.replace(".", "_"));

  let returnArr = []; 

  // We can assume filledFrames is even-length, so this doesn't error 
  for (let i = 0; i < filledFrames.length; i += 2) {
    
    let currentStartIndex = filledFrames[i]; 
    let currentEndIndex = filledFrames[i + 1]; 

    // TODO: Figure out if OpenLabeling always outputs .jpg files (can probably wildcard this b/c there'll only be one file with that file name regardless of file extension)
    // Adding paths to the input/output files
    for (let j = currentStartIndex; j <= currentEndIndex; j++) {
      returnArr = returnArr.concat(path.join(videoSpecificInputDir, videoName + "_" + j + ".jpg")); 
      returnArr = returnArr.concat(path.join(videoSpecificOutputDir, videoName + "_" + j + ".txt"));
    } 
  }

  return returnArr; 
}

// Zips the files in the given file array into a .zip file with the given name, then returns an array of the following form: 
// [ZipFileName, ZipFilePath]
// TODO: This honestly probably doesn't work b/c archiver documentation is confusing, come back to this 
function zipFiles(zipName, filePathsArr) {

  //* Zip everything in the array we just threw everything into 
  // The Zip file is VideoName_StartFrame_EndFrame
  // Not going to build in support for any non-contiguous boxing segments unless it becomes a problem...
  // In this case, I'll probalby make it VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2 and so on  
  // It'll be a miracle if any of this works 
  var writeStream = fs.createWriteStream(zipName);
  var zipFile = archiver("zip", { zlib: { level: 9 } });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  writeStream.on('close', function() {
    console.log(zipFile.pointer() + ' total bytes');
    console.log('archiver has been finalized and the output file descriptor has closed.');
  });
  
  // This event is fired when the data source is drained no matter what was the data source.
  // It is not part of this library but rather from the NodeJS Stream API.
  // @see: https://nodejs.org/api/stream.html#stream_event_end
  writeStream.on('end', function() {
    console.log('Data has been drained');
  });
  
  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  zipFile.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      // log warning
    } else {
      // throw error
      throw err;
    }
  });
  
  // good practice to catch this error explicitly
  zipFile.on('error', function(err) {
    throw err;
  });

  zipFile.pipe(writeStream);
  for (let i = 0; i < filePathsArr.length; i++) {
    // Adds the file by name, not by path 
    zipFile.file(filePathsArr[i], { name: filesToUploadNames[i] });
  } 
  zipFile.finalize();

  // Fires when the zip file is finished, presumably 
  writeStream.on("end", function() {
    console.log("zip file for current folder written!");

    //* Start the upload to box, as the zip file has completed 
    // (this is promise-based, so it will process the next one on disk right away while the network request processes)
    // TODO: I've lost motivation, fix this 
    var stream = fs.createReadStream(filesToUpload[99999999999999999]);
    client.files.uploadFile(BOX_OUTPUT_FOLDER_ID, videoNames[i], stream)
    .then(file => {
      console.log("Finished uploading file w/ name " + file.entries.name);
    });
  }); 
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
    console.log("currentFileContents: ", currentFileContents);
    console.log("Looking at file " + path.join(folder, frames[i]));
    
    // If we're currently on labeled frames, we look for one that ISN'T labeled and set the end of the interval to one before this 
    if (currentlyActive) {
      if (currentFileContents.length === 0) {
        console.log("File is empty and is the first in series to NOT be bboxed!");
        framesArr.push(i - 1); 
        currentlyActive = false; 
      } else {
        console.log("Current file was bboxed!");
      }
    }

    // Otherwise, we're currently on unlabeled frames, we look for one that IS labeled and set the beginning of next interval to current one 
    else {
      if (currentFileContents.length !== 0) {
        console.log("File was bboxed and is the first in series TO be bboxed!");
        framesArr.push(i); 
        currentlyActive = true;
      } else {
        console.log("File is empty.");
      }
    }
  }

  if (currentlyActive) {
    framesArr.push(frames.length - 1); 
  }

  return framesArr;
}

// Fills global variables imageNames and videoNames with the names of all the files 
function getVideoImageNames() {
    
  var files = fs.readdirSync(OL_INPUT_DIRECTORY); 

  // TODO: Standardize these criteria with the list of file formats OpenLabeling actually supports (currently assumes .mp4 videos and .jpg, .jpeg, or .png images)
  files.forEach(file => {
      console.log("Current File Name: " + file);

      let fileType = getFileType(file); 
      if (fileType === "video") {
          videoNames = videoNames.concat(file); 
      } else if (fileType === "image") {
          imageNames = imageNames.concat(file);
      } else if (fileType === "folder") {
          console.debug("Ignoring in input directory.")
      } else {
          console.debug("File in input directory that isn't a recognized image, video, or ")
      }
  });
}

// Returns whether the passed-in file name is a video, image, folder, or other 
function getFileType(fileName) {
    if (fileName.endsWith(".mp4")) {
        return "video"; 
    } else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png")) {
        return "image"; 
    } else if (fileName.indexOf(".") == -1) {
        return "folder"; 
    } else {
        return -1; 
    }
}

function fileNameToTxt(fileName) {
  return fileName.substring(0, fileName.indexOf(".")) + ".txt";
}

function getZipName(videoName, filledFrames) {

  // Just making sure video name is w/ the underscore and not something else 
  let endString = videoName.replace(".", "_"); 

  // Iterate through every pair of two 
  // This won't error b/c filledFrames is effectively guaranteed to be an even length 
  for (let i = 0; i < filledFrames.length; i += 2) {
    endString += "_"; 
    endString += filledFrames[i]; 
    endString += "_"; 
    endString += filledFrames[i + 1]; 
  }

  endString += ".zip";

  console.log("Given videoName " + videoName + " and filledFrames", filledFrames, "zip name is " + endString);
  return endString; 
}

function zipAndUploadFiles(filesToUpload, filesToUploadNames, filledFrames, videoName, zipPath) {

  console.log("videoName: " + videoName);
  console.log("zipPath: " + zipPath);
  console.log("filledFrames: ", filledFrames); 

  // Essentially constructing the end name of the zip file from the filledFrames array
  // Need to name it this way so we can look at Box w/o downloading anything and figure out exactly what still needs boxed 
  var endZipName = path.join(zipPath, videoName); 
  for (let i = 0; i < filledFrames.length; i++) {
    endZipName += "_"; 
    endZipName += filledFrames[i]; 
  }
  endZipName += ".zip"; 

  console.log("Name of Zip We're Uploading: " + endZipName);
  var output = fs.createWriteStream(endZipName);
  var archive = archiver("zip", { zlib: { level: 9 } } );

  output.on("close", function() {
    console.log(archive.pointer() + " total bytes"); 
    console.log('archiver has been finalized and the output file descriptor has closed.');
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

  // Only clear the output directory after I make the .zip file
  // TODO: Should probably move the "clear my output directory" to when we initially open OpenLabeling, or make it when we initially open the directory 
  clearDirectory(path.join(OL_OUTPUT_FOLDER, videoName));

  // TODO: This just uploads everything we do here to a single folder, even if we just bboxed individual files. Have this automatically make folders for each video, putting the .zip in the correct folder. 
  // Actually upload the .zip file we just made
  console.log(endZipName);
  var stream = fs.createReadStream(endZipName);
  client.files.uploadFile(BOX_OUTPUT_FOLDERID, endZipName, stream)
    .then(file => {
      console.log("Finished uploading file w/ name " + file.entries.name);
    });
}

// Fills videoNames (global variable) given the files object 
function getVideoNamesFromFilesObject(files) {
  videoNames = [];
  for (let i = 0; i < files.entries.length; i++) {
    videoNames[i] = files.entries[i].name.replace(".", "_");
  }
}