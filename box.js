// General Dependencies 
const electron = require('electron');
var rimraf = require("rimraf");
var orderBy = require("natural-orderby"); // Needed to step through video files in Natural/"Human" Order, not Alphabetical Order. Look those up if confused. 

// Interfacing w/ Box API 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API
var archiver = require("archiver");
var client; 

// OpenLabeling 
var process = require("process");
const path = require("path");
var spawn = require("child_process").spawn;
var fs = require("fs");

// Other custom JS files that we want code from 
var BoxTraversal = require("./BoxTraversal");

//* Global Variables (otherwise we'd pass them around EVERYWHERE)
const OL_INPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "input");
const OL_OUTPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "output", "YOLO_darknet");
const BOX_BASE_FOLDERID = "50377768738";
const BOX_OUTPUT_FOLDERID = "105343099285"; 
var videoNames = []; // Array of strings of each video name 

document.getElementById("boxSelectedButton").addEventListener("click", () => {
  let ids = BoxTraversal.getBoxingQueue(); 
  console.log("Got the following ids to download from BoxingQueue: ", ids); 
  if (ids.length !== 0) { // If queue is empty, don't launch OL 
    console.log("Have at least one file selected. Downloading them.");
    postExplorer(ids); 
  }
});

function updateClassList() {

  return new Promise((resolve, reject) => {
    // File ID for ClassNumbers.txt on Box
    client.files.getReadStream("655988721088", null, function(err, stream) {

      if (err) {
        // TODO: Handle this more gracefully.
        reject("Error downloading ClassNumbers.txt"); 
        reject("Please restart the app. This is likely because of an issue w/ Box itself, or your internet connection failed.");
      }
    
      // Write the file to OpenLabeling's input directory
      var writeStream = fs.createWriteStream(path.join("extraResources", "OpenLabeling", "main", "class_list.txt"), "utf8", );
      stream.pipe(writeStream);
      stream.on("end", () => {
        resolve(""); // Don't need to return anything, but we have to return the promise 
      }); 
    });
  });
}

/* 
  PURPOSE: Figures out where OpenLabeling is and launches it. 
  When done, passes control to the function that uploads the results. 
*/ 
async function launchOpenLabeling(baseDir) {

  // Change where we look for resources based on if we're developing or actually in a distribution package.
  var baseDir = resolveBaseDir();
  console.log("baseDir: " + baseDir);

  await updateClassList(baseDir); // Function is async because it relies on a file download, but 
  clearDirectory(path.join(OL_OUTPUT_FOLDER, "../")); // Get rid of existing output from the last time we ran 
  clearDirectory(path.join(baseDir, "ZipFiles"));

  // Figuring out where we launch OpenLabeling from 
  var OLMainFilePath = path.resolve(path.join(baseDir, "extraResources", "OpenLabeling", "main", "main.py"));
  console.log("Launching OpenLabeling from path " + OLMainFilePath);

  const PythonPath = "/usr/bin/python3";
  console.log("Using python interpreter located at " + PythonPath);

  // Actually spawning the process and setting up listeners for all its streams 
  // -u removes stream buffers so we get all output immediately 
  var olProcess = spawn(PythonPath, [OLMainFilePath, "-u", baseDir]);
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => {
    console.log("Child process exited with code " + code + ".");
    uploadOutput();
  });
}

function updateStatus(statusMessage) {
  document.getElementById("status").textContent = "Status: " + statusMessage;
}
 
// Very good page: https://developer.box.com/guides/authentication/access-tokens/developer-tokens/
/* PURPOSE: Goes through all the authentication stuff and gets us a fully authenticated client object that we can use to actually make requests */
// TODO: Set this to false when actually building for production 
var usingDevToken = true;
login(); // Called when page loads
function login() {

  updateStatus("Authenticating with Box.");

  let login = require("./keys.js");
  var sdk = new BoxSDK({ clientID: login.CLIENT_ID, clientSecret: login.CLIENT_SECRET });

  // If we're using a dev token, we don't have to go through all the rigamarole of getting an auth code
  if (usingDevToken) {
    console.debug("Authenticating with a dev token.");
    let login = require("./keys.js");
    client = sdk.getBasicClient(login.DEV_TOKEN);
    loginPostClient(client);
  }

  // Otherwise, we have to go in the long way
  else {

    console.debug("Authenticating without dev token.");

    //! Have the user authenticate in via Box's workflow 
    const BrowserWindow = electron.remote.BrowserWindow;
    var authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      "node-integration": false,
      "web-security": false
    });

    // Open the window the user goes through to authenticate in an electron window 
    var authorize_url = sdk.getAuthorizeURL({
      response_type: "code"
    });

    authWindow.loadURL(authorize_url);
    authWindow.show();

    let currentURL = authWindow.webContents.getURL();
    var authenticationLoop = setInterval(() => {
      
      currentURL = authWindow.webContents.getURL();
      if (currentURL.startsWith("https://localhost:1337")) {
        clearInterval(authenticationLoop);

        authWindow.close();
        let authCode = currentURL.substring(currentURL.indexOf("=") + 1);

        // Set up the client, then call next function 
        sdk.getTokensAuthorizationCodeGrant(authCode, null, function (err, tokenInfo) {
          if (err) console.log("Error exchanging auth code! err: ", err);
          var TokenStore = require("./TokenStore"); // SDK essentially needs somewhere to store the access token stuff 
          var tokenStore = new TokenStore("test");
          client = sdk.getPersistentClient(tokenInfo, tokenStore); // Persistent client automatically refreshes; Only possible w/ no dev token
          loginPostClient(client);
        });
      }
    }, 10);
  }
}

/* 
  PURPOSE: Downloads all the files we're about to bbox to the correct directory, then
  passes control to the function that launches OpenLabeling. */ 
async function loginPostClient() {

  // Box File Structure Traversal Setup 
  BoxTraversal.setClient(client);
  BoxTraversal.fillFromBaseFolder(BOX_BASE_FOLDERID);
  BoxTraversal.displayFolder(BOX_BASE_FOLDERID); 

  // Get our input directory back to its original point
}

/* Takes in an array of Box File IDs, downloads them, lets the user Box them, then uploads them to Box. 
    Clark, if you're reading this, you'll just call this function once after you get the files that the user should Box; 
    This will take care of the rest. Doesn't return anything. */ 
function postExplorer(downloadIDs) {

  let numFilesDownloaded = 0; // Number of files that network requests have completed. 

  console.debug("Downloading all of the following ids: " + downloadIDs); 

  // Iterate through each ID that we have to download 
  for (let i = 0; i < downloadIDs.length; i++) {

    // Get information about the file so we know what to name it
    client.files.get(downloadIDs[i])
    .then(file => {

      console.debug("Downloading file named " + file.name);

      // Then actually download the file 
      client.files.getReadStream(downloadIDs[i], null, function(err, stream) {

        // If there was an error downloading, complain about it 
        if (err) {
          // TODO: Handle this more gracefully.
          console.error("Error downloading file with id " + downloadIDs[i]); 
          console.error("Please restart the app. This is likely because of an issue w/ Box itself, or your internet connection failed.");
        } 

        console.log("Opened read stream to the object.");
  
        // Write the file to OpenLabeling's input directory
        var output = fs.createWriteStream(path.join(OL_INPUT_FOLDER, file.name)); 
        console.log("Created write stream.");
        stream.pipe(output);

        console.log("Piping the stream to the object.");

        // If we fire the "end" event, we know that the file fully downloaded
        stream.on("end", () => {
          console.debug("Finished downloading file named " + file.name + " to location " + OL_INPUT_FOLDER);
          videoNames.push(file.name.replace(".", "_"));
          numFilesDownloaded++;

          // Because JS is asynchronous and will do the network requests for these files at the same time, this is how we have to 
          // make sure that we downloaded everything before we actually launch OpenLabeling 
          if (numFilesDownloaded >= downloadIDs.length) {
            launchOpenLabeling();
          }
        });
      });
    });
  } 
}

/* 
  1. Makes a folder with the name of the video on box if one doesn't exist 
  2. Goes into that folder 
  3. Uploads a zip file with both the individual video frames and their .txt throughput 
*/

/* 
  Purpose: 
  1. Makes a folder with the name of the video on box if one doesn't exist 
  2. Goes into that folder 
  3. Uploads a zip file with both the individual video frames and their .txt throughput 
*/
function uploadOutput() {

  // Iterate through each video's files 
  // Note: videoNames is global, and we initialized it right before OpenLabeling opened
  for (let i = 0; i < videoNames.length; i++) {

    let filesToUpload = [];
    let filesToUploadNames = [];

    //* Get a big list of all the files in the important I/O directories 
    let currentInputSubfolder = path.join(OL_INPUT_FOLDER, videoNames[i]);
    let currentOutputSubfolder = path.join(OL_OUTPUT_FOLDER, videoNames[i]);

    // Have to run these through Human Sorting so that they don't 5
    let inputFiles = orderBy.orderBy(fs.readdirSync(currentInputSubfolder));
    let outputFiles = orderBy.orderBy(fs.readdirSync(currentOutputSubfolder));
    let filledFrames = getFilledFrames(videoNames[i]); 

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
    }

    console.debug("filesToUpload: ", filesToUpload);
    console.debug("filesToUploadNames: ", filesToUploadNames);

    //* Zip everything in the array we just threw everything into 
    // The Zip file is VideoName_StartFrame_EndFrame
    // Not going to build in support for any non-contiguous boxing segments unless it becomes a problem...
    // In this case, I'll probalby make it VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2 and so on  
    // It'll be a miracle if any of this works 

    zipAndUploadFiles(filesToUpload, filesToUploadNames, filledFramesBackup, videoNames[i], "ZipFiles"); 
  }
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

/* TODO: I merged a LOT of functions here, a lot will probably be overlaps */ 

/* 
  Returns an array of format 

  [FirstFilledIntervalStart, FirstFilledIntervalEnd, SecondFilledIntervalStart, SecondFilledIntervalEnd, ...] 
  given an actual video name. All the file paths are Scylla-specific, basically. 
*/
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

// This function returns a path to our base directory, sensing whether we're in development or distribution
// This is necessary for stuff to work properly when we're in a built version of the app, rather than just `yarn start` (development version)
function resolveBaseDir() {
  if (process.resourcesPath.endsWith("Scylla/node_modules/electron/dist/resources")) {
    console.log("We are in the development environment!");
    return __dirname;
  } else {
    console.log("We are in the distribution environment!");
    return path.join(process.resourcesPath);
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

// Performs `rm -rf` at the given file path 
function clearDirectory(filePath) {
  console.debug("Deleting everything in directory " + filePath);
  rimraf.sync(path.join(filePath, "*"));
  console.debug("Deleted everything in directory " + filePath);
}