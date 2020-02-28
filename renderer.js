// General Dependencies 
const electron = require('electron'); 
var process = require("process");

// Finding Files, Moving Files Around
const glob = require("glob");
const path = require("path");

// Launching Python app on proxy w/ main app, essentially 
var spawn = require("child_process").spawn;

// Interfacing w/ BuckeyeBox 
var fetch = require("node-fetch"); 
var BoxSDK = require("box-node-sdk");
var fs = require("fs"); 

// Called from HTML onClick 
// TODO: Lots of debug statements in here, get rid of them in "final" app version 
function launchOpenLabeling() {
  
  // Launching process uisng child_process module 
  console.log("process.resourcesPath: " + process.resourcesPath);
  console.log("__dirname: " + __dirname);

  // Change where we look for resources based on if we're developing 
  // or actually in a distribution package.
  var baseDir; 
  if (process.resourcesPath.endsWith("Scylla/node_modules/electron/dist/resources")) {
    console.log("We are in the development environment!"); 
    baseDir = path.join(__dirname, "../"); 
  } else {
    console.log("We are in the distribution environment!");
    baseDir = path.join(process.resourcesPath);
  }
  console.log("baseDir: " + baseDir);

  var mainPath = path.resolve(path.join(baseDir, "extraResources", "OpenLabeling", "main", "main.py"));
  console.log("Launching OpenLabeling from path " + mainPath);
  var olProcess = spawn("/usr/bin/python3", [
    mainPath, 
    "-u", 
    baseDir ]);

  // Debug streams, essentially
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => { console.log("Child process exited with code " + code + "."); });
}

// Actuates whether we're using a dev token or going through the actual box workflow 
var usingDevToken = true; 
function authenticateIntoBox() {
  if (!usingDevToken) {
    // create a broser pop up window for auth
    const BrowserWindow = electron.remote.BrowserWindow;
    var authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      "node-integration": false,
      "web-security": false
    });

    // generate the box auth url
    var login = require("../keys.js"); 
    var sdk = new BoxSDK({ 
      clientID: login.CLIENT_ID,
      clientSecret: login.CLIENT_SECRET
    });

    var authorize_url = sdk.getAuthorizeURL({
      response_type: "code"
    });

    console.log("authorize_url: " + authorize_url); 
    authWindow.loadURL(authorize_url);
    authWindow.show();

    let currentURL = authWindow.webContents.getURL(); 
    const timeout = () => {
      setTimeout(function() {
        currentURL = authWindow.webContents.getURL();
        console.log("Current URL: " + currentURL); 
        if (currentURL.startsWith("https://localhost:1337")) { 
          authWindow.close();
          postLogin(currentURL.substring(currentURL.indexOf("=") + 1)); 
        } else {
          timeout();
        }
      }, 10);
    };

    timeout();
  } else {
    const login = require("./keys.js"); 
    postLogin(login.CLIENT_ID, login.CLIENT_SECRET, login.DEV_TOKEN); 
  }  
}

// Very good page: https://developer.box.com/guides/authentication/access-tokens/developer-tokens/
let BOX_INPUT_FOLDER_ID = "100533349334"; 
let BOX_OUTPUT_FOLDER_ID = "";
async function postLogin(clientID, clientSecret, accessToken) {

  // Debug 
  console.log("Passed-In Client ID: " + clientID); 
  console.log("Passed-In Client Secret: " + clientSecret); 
  console.log("Passed-In Access Code: " + accessToken); 

  var sdk = new BoxSDK({ clientID: clientID, clientSecret: clientSecret }); 
  
  // TODO: Turn this into persistent client and do refresh tokens 
  // More info here: https://github.com/box/box-node-sdk#persistent-client
  var client = BoxSDK.getBasicClient(accessToken); 

  console.log("client Object: "); 
  console.log(client); 

  client.users.get(client.CURRENT_USER_ID)
  .then(user => console.log("Hello " + user.name + "!"))
  .catch(err => console.log("Error: " + err)); 

  client.folders.get(BOX_INPUT_FOLDER_ID)
  .then(folder => {
    console.log("Folder Object: ");
    console.log(folder); 
  })
}
