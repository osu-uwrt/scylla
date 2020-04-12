// TODO: Redo the styling to be dark mode (cause light mode sucks) 
// General Dependencies 
const electron = require('electron');
var rimraf = require("rimraf");

// Interfacing w/ Box API 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API
var archiver = require("archiver");
var client; 

// OpenLabeling 
var process = require("process");
const path = require("path");
var spawn = require("child_process").spawn;
var fs = require("fs");

/* General Process: 

  - Whenever we actually open OpenLabeling, process the input folder and save names of the images and videos so we can use it later
  - When we're done, process all images, then process all videos 
    - For images, use the "images" directory on Box and just upload the image with its bbox data 
    - For videos, read in files until we find the last one that was boxed. Upload the image files and corresponding YOLO output for everything up to that 
      point, saving the zip file as VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2... and so on.
        - I consider it a safe assumption to make that box doesn't really have a name character limit, and each frame should only be max like 3-4 digits long

*/
// Keeping track of the actual image and video names (global variables; We 
// reference them so much that it's worth it)
var imageNames = []; 
var videoNames = []; 

var baseDir; 
const OL_INPUT_DIRECTORY = path.join("extraResources", "OpenLabeling", "main", "input"); 
const OL_OUTPUT_DIRECTORY = path.join("extraResources", "OpenLabeling", "output"); 

// Does exactly what you think it does 
function launchOpenLabeling() {

  // Save our base directory and lists of images/files we are about to process in some global variables b/c we use them all over the place 
  getVideoImageNames();

  // Figuring out where to look for OpenLabeling's launch file 
  let baseDir = resolveBaseDir();
  var OLMainFilePath = path.resolve(path.join(baseDir, "extraResources", "OpenLabeling", "main", "main.py"));
  console.log("Launching OpenLabeling from path " + OLMainFilePath);

  const PythonPath = "/usr/bin/python3"; 
  console.log("Using python interpreter located at " + PythonPath);

  // Actually spawning the process and setting up listeners for all its streams 
  // -u removes stream buffers so we get all output immediately 
  var olProcess = spawn(PythonPath, [ OLMainFilePath, "-u", baseDir ] );
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => {
    console.log("Child process exited with code " + code + ".");
    uploadOutput();
  });
}
 
// Very good page: https://developer.box.com/guides/authentication/access-tokens/developer-tokens/
// TODO: Set this to false when building for production. To be super performace oriented, we could get rid of all the code paths we don't follow, but that's a negligible performance increase and this makes development way quicker. 
var usingDevToken = true;
login(); // Called when page loads (intent-based thing)
function login() {

  onScreenDebug("Status: Authenticating user into Box.");

  // Make an instance of the SDK with our client-specific details 
  // (tells the client which folders we have access to) 
  let login = require("./keys.js");
  var sdk = new BoxSDK({ clientID: login.CLIENT_ID, clientSecret: login.CLIENT_SECRET });

  // If we're using a dev token, we don't have to go through all the rigamarole of getting an auth code 
  if (usingDevToken) {
    let login = require("./keys.js");
    client = sdk.getBasicClient(login.DEV_TOKEN);
    loginPostClient();
  }

  // We have to authenticate the user to get an auth code 
  // (we can do a persistent client this way that automatically refreshes codes though)
  else {

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
    const timeout = () => {
      setTimeout(function () {
        currentURL = authWindow.webContents.getURL();
        console.log("Current URL: " + currentURL);

        // If we've successfully authenticated and been redirected 
        if (currentURL.startsWith("https://localhost:1337")) {
          authWindow.close();
          let authCode = currentURL.substring(currentURL.indexOf("=") + 1);

          // Set up the client, then call next function 
          sdk.getTokensAuthorizationCodeGrant(authCode, null, function (err, tokenInfo) {
            if (err) {
              console.log("Error exchanging auth code! err: ", err);
            }

            var TokenStore = require("./TokenStore");
            var tokenStore = new TokenStore("test");
            client = sdk.getPersistentClient(tokenInfo, tokenStore);
            loginPostClient();
          });
        }

        // Otherwise, the user is still authenticating; Call again in 10ms 
        else {
          timeout();
        }
      }, 10);
    };

    // Start off the async recursion chain 
    timeout();
  }
}

async function loginPostClient() {

  // Client is now a global variable, b/c it's needed in a LOT of places
  console.log("Got Client Object: ", client);
  const BOX_RAW_FOLDER_ID = "88879798045";
  const LOCAL_INPUT_FOLDER_PATH = path.join("extraResources", "OpenLabeling", "main", "input");

  document.getElementById("loginRedo").style.display = "none"; // Get rid of backup re-authenticate button 

  // TODO: Ideally, we don't automatically download everything in the folder, but rather have them select which file they want to box, *then* download it.
  // TODO: Make it only display files that haven't been boxed yet.
  clearInputDirectory();
  client.folders.getItems(BOX_RAW_FOLDER_ID)
  .then(files => {
    console.log("All the files in the folder: ", files);
    files.entries.forEach(file => {
      onScreenDebug("Downloading files.");
      client.files.getReadStream(file.id, null, function (err, stream) {
        if (err) console.error("File Download Error: ", err);
        let writeStream = fs.createWriteStream(path.join(LOCAL_INPUT_FOLDER_PATH, file.name));
        stream.pipe(writeStream);
        writeStream.on("close", function () {
          onScreenDebug("Status: Downloaded files. Opening OpenLabeling!");
          launchOpenLabeling();
        });
      });
    });
  });
}

/* 
  1. Makes a folder with the name of the video on box if one doesn't exist 
  2. Goes into that folder 
  3. Uploads a zip file with both the individual video frames and their .txt throughput 
*/

// imageNames, videoNames 
function uploadOutput() {

  // Iterate through all the images we need to upload and just straight upload them 
  const IMAGE_OUTPUT_DIRECTORY_ID = "107635394307"; 
  var outputImagePath, inputImagePath;
  for (let i = 0; i < imageNames.length; i++) {

    inputImagePath = path.join(OL_INPUT_DIRECTORY, imageNames[i]); 
    outputImagePath = path.join(OL_OUTPUT_DIRECTORY, imageNames[i]); 

    // TODO: Figure out if the fact that these are asynchronous calls will screw with stuff... There's probably a way to quit the application as soon as all the callbacks are done like adding to a value every time, but I don't have the will to look it up right now 
    // Upload input image
    var inputImageReadStream = fs.createReadStream(inputImagePath); 
    client.files.uploadFile(IMAGE_OUTPUT_DIRECTORY_ID, imageNames[i], inputImageReadStream); 

    // Upload output image 
    var outputImageReadStream = fs.createReadStream(outputImagePath); 
    client.files.uploadFile(IMAGE_OUTPUT_DIRECTORY_ID, toTXTFileExt(imageNames[i]), outputImageReadStream);
  }

  // Iterate through each video name, finding the frames that were labeled, then zip both the .jpg and .txt for each of those files  
  const OUTPUT_DIRECTORY_ID = "105343099285"; 
  for (let i = 0; i < videoNames.length; i++) {
    let filledFrames = getFilledFrames(videoNames[i]);
    let zipName = getZipName(videoNames[i], filledFrames);  

    // Returns an actual array with file paths to the non-empty files we need to grab 
    let nonEmptyFilePaths = getFilePathsToNonEmptyFile(videoNames[i], filledFrames);

    // Actually zip all the files together 
    zipFiles(zipName, nonEmptyFilePaths);

    // Start the upload of that .zip file to Box 
    let readStream = fs.createReadStream(path.join(OL_OUTPUT_DIRECTORY, zipName));  
    client.files.uploadFile(OUTPUT_DIRECTORY_ID, zipName, readStream)
    .then(file => {
      console.log("Finished upload of .zip file named " + file.entries[0].name); 
    })
  }
}

function getFilePathsToNonEmptyFile(videoName, filledFrames) {

  let videoSpecificInputDir = path.join(OL_INPUT_DIRECTORY, videoName.replace(".", "_"));
  let videoSpecificOutputDir = path.join(OL_OUTPUT_DIRECTORY, "YOLO_darknet", videoName.replace(".", "_"));

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

// ! EVERYTHING BELOW HERE IS A HELPER FUNCTION
// (for organizational issues) 

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
function getFilledFrames(videoFileName) {

  var videoFolderName = videoNameToFolderName(videoFileName);
  var folder = path.join(OL_OUTPUT_DIRECTORY, "YOLO_darknet", videoFolderName);
  var frames = fs.readdirSync(folder);

  // The thing we're returning, see description right above function for explanation 
  var framesArr = []; 

  // Note: OpenLabeling's output starts at index zero, so I'm using that convention 
  var currentlyActive = false; 
  var currentFileContents; 
  for (let i = 0; i < frames.length; i++) {

    currentFileContents = fs.readFileSync(path.join(folder, frames[i])); 

    // If we're currently on labeled frames, we look for one that ISN'T labeled and set the end of the interval to one before this 
    if (currentlyActive) {
      if (currentFileContents === "") {
        framesArr.push(i - 1); 
        currentlyActive = false; 
      }
    } 
    
    // Otherwise, we're currently on unlabeled frames, we look for one that IS labeled and set the beginning of next interval to current one 
    else {
      if (currentFileContents !== "") {
        framesArr.push(i); 
        currentlyActive = true;
      }
    }
  }

  if (currentlyActive) {
    framesArr.push(frames.length - 1); 
  }

  return framesArr;
}

// Does exactly what you think it does 
function removeChildrenOfElement(element) {
  while (element.lastElementChild) {
      element.removeChild(element.lastElementChild);
  }
}

function videoNameToFolderName(videoFileName) {
  return videoFileName.replace(".", "_"); 
}

function clearInputDirectory() {
  console.log("Deleting everything in the /input folder before we download anything.");
  rimraf.sync(path.join("extraResources", "OpenLabeling", "main", "input", "*"));
}

function onScreenDebug(text) {
  document.getElementById("status").textContent = text;
  console.log(text);
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
function resolveBaseDir() {
  if (process.resourcesPath.endsWith("Scylla/node_modules/electron/dist/resources")) {
    console.log("We are in the development environment!");
    return __dirname;
  } else {
    console.log("We are in the distribution environment!");
    return path.join(process.resourcesPath);
  }
}

function toTXTFileExt(fileName) {
  fileName = fileName.substring(0, fileName.indexOf(".")); 
  console.log("Given file " + fileName + ", the .txt version is " + fileName + ".txt");
  return fileName + ".txt";
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