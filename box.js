// TODO: Redo the styling to be dark mode (cause light mode sucks) 
// General Dependencies 
const electron = require('electron');
var rimraf = require("rimraf");

// Interfacing w/ Box API 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API
var archiver = require("archiver");

// OpenLabeling 
var process = require("process");
const path = require("path");
var spawn = require("child_process").spawn;
var fs = require("fs");

//* Global Variables (otherwise we'd pass them around EVERYWHERE)
// File Paths 
const OL_INPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "input");
const OL_OUTPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "output", "YOLO_darknet");

// Box Folder IDs
const BOX_INPUT_FOLDERID = "88879798045";
const BOX_OUTPUT_FOLDERID = "105343099285";
// const BOX_OUTPUT_IMAGES_FOLDERID = "107635394307";

// Important Program Variables 
var videoNames;

// Does exactly what you think it does 
function launchOpenLabeling(client, videoNames) {

  clearDirectory(path.join(OL_OUTPUT_FOLDER, "../"));

  // Change where we look for resources based on if we're developing or actually in a distribution package.
  var baseDir = resolveBaseDir();
  console.log("baseDir: " + baseDir);

  // Figuring out where to look for OpenLabeling's launch file 
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
    uploadOutput(client, videoNames);
  });
}

// Very good page: https://developer.box.com/guides/authentication/access-tokens/developer-tokens/
// TODO: Set this to false when building for production. To be super performace oriented, we could get rid of all the code paths we don't follow, but that's a negligible performance increase and this makes development way quicker. 
var usingDevToken = true;
login(); // Called when page loads (intent-based thing)
function login() {

  // Make an instance of the SDK with our client-specific details 
  // (tells the client which folders we have access to) 
  let login = require("./keys.js");
  var sdk = new BoxSDK({ clientID: login.CLIENT_ID, clientSecret: login.CLIENT_SECRET });

  // If using a dev token, make a basic client b/c you can't refresh a dev token 
  var client;

  // If we're using a dev token, we don't have to go through all the rigamarole of getting an auth code 
  if (usingDevToken) {
    console.debug("Using a dev token.");
    let login = require("./keys.js");
    client = sdk.getBasicClient(login.DEV_TOKEN);
    console.debug("Successfully got client object.");
    loginPostClient(client);
  }

  // We have to authenticate the user to get an auth code 
  // (we can do a persistent client this way that automatically refreshes codes though)
  else {

    console.debug("Going through normal oauth (no dev token).");

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
            console.debug("Successfully got client object.");
            loginPostClient(client);
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

async function loginPostClient(client) {

  console.debug("Grabbing data from box raw folder id " + BOX_OUTPUT_FOLDERID);
  console.debug("Videos were downloaded to " + OL_INPUT_FOLDER);

  console.debug("Clearing input directory before we download to it.");
  clearDirectory(OL_INPUT_FOLDER);

  console.debug("Making client.folder.getItems API call on box raw folder");
  client.folders.getItems(BOX_INPUT_FOLDERID)
    .then(files => {

      console.debug("Got files object: ", files);

      console.debug("Iterating through each file and downloading.");
      files.entries.forEach(file => {

        client.files.getReadStream(file.id, null, function (err, stream) {

          if (err) console.error("File Download Error: ", err);

          console.debug("File downloaded successfully. Writing to disk.");
          let writeStream = fs.createWriteStream(path.join(OL_INPUT_FOLDER, file.name));
          stream.pipe(writeStream);

          writeStream.on("close", function () {
            getVideoNamesFromFilesObject(files);
            launchOpenLabeling(client, videoNames);
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
function uploadOutput(client) {

  // Need to put complete file paths in here 
  // Go into OL_YOLO_OUTPUT_FOLDER and use everything in there (should be all .txt files) 
  // Go into OL_INPUT_VIDEO_FOLDERS and use everything in there (should be all the corresponding .jpg files) 
  // TODO: Make all these requests actually asynchronous, shouldn't be necessary unless there's a noticeable delay here. There really shouldn't be a relevant delay, fs operations are hella quick 

  // Add all the files from the input folders 
  for (let i = 0; i < videoNames.length; i++) {

    let filesToUpload = [];
    let filesToUploadNames = [];

    //* Get a big list of all the files in the important I/O directories 
    let currentInputSubfolder = path.join(OL_INPUT_FOLDER, videoNames[i]);
    let currentOutputSubfolder = path.join(OL_OUTPUT_FOLDER, videoNames[i]);
    let inputFiles = fs.readdirSync(currentInputSubfolder);
    let outputFiles = fs.readdirSync(currentOutputSubfolder);

    //* Queue the Input/Output files for the current video to be zipped 
    for (let j = 0; j < inputFiles.length; j++) {

      // If that file isn't empty, add all its stuff to what we're zipping 
      if (fs.statSync(path.join(OL_OUTPUT_FOLDER, videoNames[i], inputFiles[j].replace(".jpg", ".txt"))).size != 0) {
        filesToUpload = filesToUpload.concat(path.join(OL_INPUT_FOLDER, videoNames[i], inputFiles[j]));
        filesToUploadNames = filesToUploadNames.concat(inputFiles[j]);

        filesToUpload = filesToUpload.concat(path.join(OL_OUTPUT_FOLDER, videoNames[i], outputFiles[j]));
        filesToUploadNames = filesToUploadNames.concat(outputFiles[j]);
      }      
    }

    console.debug("filesToUpload: ", filesToUpload);
    console.debug("filesToUploadNames: ", filesToUploadNames);

    //* Zip everything in the array we just threw everything into 
    // The Zip file is VideoName_StartFrame_EndFrame
    // Not going to build in support for any non-contiguous boxing segments unless it becomes a problem...
    // In this case, I'll probalby make it VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2 and so on  
    // It'll be a miracle if any of this works 

    zipAndUploadFiles(filesToUpload, filesToUploadNames, videoNames[i], path.join("ZipFiles", videoNames[i] + ".zip")); 

    /*
    // Fires when the zip file is finished, presumably 
    writeStream.on("end", function () {
      console.log("zip file for current folder written!");

      //* Start the upload to box, as the zip file has completed 
      // (this is promise-based, so it will process the next one on disk right away while the network request processes)
      // TODO: I've lost motivation, fix this 
      var stream = fs.createReadStream(filesToUpload[99999999999999999]);
      client.files.uploadFile(BOX_OUTPUT_FOLDERID, videoNames[i], stream)
        .then(file => {
          console.log("Finished uploading file w/ name " + file.entries.name);
        });
    });
    */
  }
}

function zipAndUploadFiles(filesToUpload, filesToUploadNames, videoName, zipPath) {
  var output = fs.createWriteStream(path.join(zipPath));
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
  // clearDirectory(path.join(OL_OUTPUT_FOLDER, videoName));

  // Upload the file 
}

// Updates the front-end display based on the files object returned from client.folder.get("FOLDER_ID") on https://github.com/box/box-node-sdk/blob/master/docs/folders.md
// We could also just feed in the folder id here, but we don't want more than one network request to the same thing 
function displayFolderContents(files) {

  // TODO: Clark, write this. I already have all the calls to this function done. 
  return;

}

// ! BELOW HERE ARE THE LESS IMPORTANT / UTILITY FUNCTIONS 

// Fills videoNames (global variable) given the files object 
function getVideoNamesFromFilesObject(files) {
  videoNames = [];
  for (let i = 0; i < files.entries.length; i++) {
    videoNames[i] = files.entries[i].name.replace(".", "_");
  }
}

async function removeChildrenOfElement(element) {
  while (element.lastElementChild) {
    element.removeChild(element.lastElementChild);
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

// Performs `rm -rf` at the given file path 
function clearDirectory(filePath) {
  console.debug("Deleting everything in directory " + filePath);
  rimraf.sync(path.join(filePath, "*"));
  console.debug("Deleted everything in directory " + filePath);
}