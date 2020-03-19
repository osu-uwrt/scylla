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

// Does exactly what you think it does 
function launchOpenLabeling(client, videoNames) {

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
  var olProcess = spawn(PythonPath, [ OLMainFilePath, "-u", baseDir ] );
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => {
    console.log("Child process exited with code " + code + ".");
    uploadOutput(client, videoNames);
  });
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

  // If using a dev token, make a basic client b/c you can't refresh a dev token 
  var client;

  // If we're using a dev token, we don't have to go through all the rigamarole of getting an auth code 
  if (usingDevToken) {
    let login = require("./keys.js");
    client = sdk.getBasicClient(login.DEV_TOKEN);
    loginPostClient(client);
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

  console.log("Got Client Object: ", client);
  const BOX_RAW_FOLDER_ID = "88879798045";
  const LOCAL_INPUT_FOLDER_PATH = path.join("extraResources", "OpenLabeling", "main", "input");

  document.getElementById("loginRedo").style.display = "none"; // Get rid of backup re-authenticate button 

  // TODO: Ideally, we don't automatically download everything in the folder, but rather have them select which file they want to box, *then* download it.
  // TODO: Make it only display files that haven't been boxed yet.
  clearInputDirectory();
  let root = document.getElementById("box_folder");
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
            let videoNames = getVideoNamesFromFilesObject(files);
            launchOpenLabeling(client, videoNames);
          });
        });
      });
    });
}

function getVideoNamesFromFilesObject(files) {

  let endObject = []; 

  // Only change we have to make is replacing the period with an underscore 
  for (let i = 0; i < files.entries.length; i++) {
    endObject[i] = files.entries[i].name.replace(".", "_");
  }

  console.log("getVideoNamesFromFilesObject return: ", endObject);

  return endObject;
}

async function removeChildrenOfElement(element) {
  while (element.lastElementChild) {
    element.removeChild(element.lastElementChild);
  }
}

function clearInputDirectory() {
  console.log("Deleting everything in the /input folder before we download anything.");
  rimraf.sync(path.join("extraResources", "OpenLabeling", "main", "input", "*"));
}

function onScreenDebug(text) {
  document.getElementById("status").textContent = text;
  console.log(text);
}

/* 
  1. Makes a folder with the name of the video on box if one doesn't exist 
  2. Goes into that folder 
  3. Uploads a zip file with both the individual video frames and their .txt throughput 
*/
function uploadOutput(client, videoNames) {

  const BOX_OUTPUT_FOLDER_ID = "105343099285";

  // Getting folder places organized 
  const OL_INPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "input");
  const OL_YOLO_OUTPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "output", "YOLO_darknet");

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
    let currentOutputSubfolder = path.join(OL_YOLO_OUTPUT_FOLDER, videoNames[i]); 
    let inputFiles = fs.readdirSync(currentInputSubfolder);
    let outputFiles = fs.readdirSync(currentOutputSubfolder);

    //* Queue the Input/Output files for the current video to be zipped 
    for (let j = 0; j < inputFiles.length; j++) {
      filesToUpload = filesToUpload.concat(path.join(OL_INPUT_FOLDER, videoNames[i], inputFiles[j])); 
      filesToUploadNames = filesToUploadNames.concat(inputFiles[j]);
    }

    for (let j = 0; j < outputFiles.length; j++) {
      filesToUpload = filesToUpload.concat(path.join(OL_YOLO_OUTPUT_FOLDER, videoNames[i], outputFiles[j])); 
      filesToUploadNames = filesToUploadNames.concat(outputFiles[j]);
    }

    //* Zip everything in the array we just threw everything into 
    // The Zip file is VideoName_StartFrame_EndFrame
    // Not going to build in support for any non-contiguous boxing segments unless it becomes a problem...
    // In this case, I'll probalby make it VideoName_StartFrame1_EndFrame1_StartFrame2_EndFrame2 and so on  
    // It'll be a miracle if any of this works 
    var writeStream = fs.createWriteStream(path.join(__dirname, videoNames[i] + ".zip"));
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
    for (let j = 0; j < filesToUpload.length; j++) {
      // Adds the file by name, not by path 
      zipFile.file(filesToUpload[j], { name: filesToUploadNames[j] });
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
}
