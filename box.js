// General Dependencies 
const electron = require('electron');
var rimraf = require("rimraf");

// Interfacing w/ Box API 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API
var client; 

// OpenLabeling 
var process = require("process");
const path = require("path");
var spawn = require("child_process").spawn;
var fs = require("fs");

// Other custom JS files that we want code from 
var BoxTraversal = require("./BoxTraversal");
var Upload = require("./Upload");
var { updateStatus, clearDirectory, resolveBaseDir } = require("./Utility");

//* Global Variables (otherwise we'd pass them around EVERYWHERE)
const OL_INPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "input");
const OL_OUTPUT_FOLDER = path.join("extraResources", "OpenLabeling", "main", "output", "YOLO_darknet");
const BOX_BASE_FOLDERID = "50377768738";

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

// What actually triggers launching OpenLabeling 
document.getElementById("boxSelectedButton").addEventListener("click", () => {
  let ids = BoxTraversal.getBoxingQueue(); 
  if (ids.length === 0) {
    console.error("Tried to launch OpenLabeling with zero IDs to download!"); 
  } else {
    console.log("Downloading the following IDs to feed into OpenLabeling: ", ids);
    postExplorer(ids); 
  }
});

// Downloads the files signified by the IDs to the correct spot, then 
// feeds them into OpenLabeling 
function postExplorer(downloadIDs) {

  let numFilesDownloaded = 0; // Number of files that network requests have completed. 
  updateStatus("Downloading all the files...");
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
          Upload.appendToVideoNames(file.name);
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
  
  // TODO: Get this working with promises; The current way I do this works, but isn't the "javascript" way to do it.
  /* What I have here is close, but getting the array of promises is still a little off. 
  // Get a promise for the download of each individual file 
  let promises = new Promise(resolve => {
    
    downloadIDs.map(fileID => {
      
      client.files.get(fileID)
      .then(file => {
        
        client.files.getReadStream(fileID, null, (err, stream) => {
          
          if (err) {
            console.error("Error downloading file with id " + fileID); 
            return; 
          }

          // Write the file to OpenLabeling's input directory
          var output = fs.createWriteStream(path.join(OL_INPUT_FOLDER, file.name)); 
          console.log("Created write stream.");
          stream.pipe(output);

          console.log("Piping the stream to the object.");

          // If we fire the "end" event, we know that the file fully downloaded
          stream.on("end", () => {
            console.debug("Finished downloading file named " + file.name + " to location " + OL_INPUT_FOLDER);
            videoNames.push(file.name.replace(".", "_"));
            resolve(); 
          });
        });
      }); 
    }); 
  });

  // The .then() block here executes when all of the above promises are done
  Promise.all(promises).then(() => {
    console.log("Downloaded all selected files.");
    // launchOpenLabeling(); 
  });
  */
}

// Starts up our system for actually traversing Box and selecting files 
async function loginPostClient() {
  BoxTraversal.setClient(client);
  BoxTraversal.displayFolder(BOX_BASE_FOLDERID); 
}

/* 
  PURPOSE: Figures out where OpenLabeling is and launches it. 
  When done, passes control to the function that uploads the results. 
*/ 
async function launchOpenLabeling(baseDir) {

  updateStatus("Launching OpenLabeling.");

  // Change where we look for resources based on if we're developing or actually in a distribution package.
  baseDir = resolveBaseDir();
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
    Upload.setClient(client);
    Upload.start();
  });
}