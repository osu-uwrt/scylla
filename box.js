// TODO: Redo the styling to be dark mode (cause light mode sucks) 
// General Dependencies 
const electron = require('electron');

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
    return path.join(__dirname);
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
  var rimraf = require("rimraf");
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
  let filesToUpload = []; 

  // Add all the files from the input folders 
  for (let i = 0; i < videoNames.length; i++) {

    let currentBaseFolder = path.join(OL_INPUT_FOLDER, videoNames[i]); 
    let dirContents = fs.readdirSync(currentBaseFolder);

    // Make them all absolute (well, relative to base directory) paths
    for (let j = 0; j < dirContents.length; j++) {
      dirContents[j] = path.join(OL_INPUT_FOLDER, videoNames[i], dirContents[j]); 
    }

    filesToUpload = filesToUpload.concat(dirContents);
  }

  // Add all the files from the output folders 
  for (let i = 0; i < videoNames.length; i++) {

    currentBaseFolder = path.join(OL_YOLO_OUTPUT_FOLDER, videoNames[i]); 
    let dirContents = fs.readdirSync(currentBaseFolder);

    // Make them all absolute (well, relative to base directory) paths
    for (let j = 0; j < dirContents.length; j++) {
      dirContents[j] = path.join(OL_YOLO_OUTPUT_FOLDER, videoNames[i], dirContents[j]); 
    }

    filesToUpload = filesToUpload.concat(dirContents);
  }

  console.log("filesToUpload: ", filesToUpload);

  // Zip those files 
  // TODO: Figure out if I want to zip by video, or what, or how exactly I'm tracking which files have been boxed yet 

  // Upload them to Box 
}
