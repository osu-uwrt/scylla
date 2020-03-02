// General Dependencies 
const electron = require('electron'); 

// Interfacing w/ Box API 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API

// OpenLabeling 
var process = require("process");
const path = require("path");
var spawn = require("child_process").spawn;
var fs = require("fs"); 

function launchOpenLabeling() {
  
  // Launching process uisng child_process module 
  console.log("process.resourcesPath: " + process.resourcesPath);
  console.log("__dirname: " + __dirname);

  // Change where we look for resources based on if we're developing 
  // or actually in a distribution package.
  var baseDir; 
  if (process.resourcesPath.endsWith("Scylla/node_modules/electron/dist/resources")) {
    console.log("We are in the development environment!"); 
    baseDir = path.join(__dirname); 
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

// Very good page: https://developer.box.com/guides/authentication/access-tokens/developer-tokens/
// TODO: Set this to false when building for production. To be super performace oriented, we could get rid of all the code paths we don't follow, but that's a negligible performance increase and this makes development way quicker. 
var usingDevToken = true; 
login(); // Called when page loads (intent-based thing)
function login() {

  console.log("login() called.");

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
      setTimeout(function() {
        currentURL = authWindow.webContents.getURL();
        console.log("Current URL: " + currentURL); 

        // If we've successfully authenticated and been redirected 
        if (currentURL.startsWith("https://localhost:1337")) { 
          authWindow.close();
          let authCode = currentURL.substring(currentURL.indexOf("=") + 1); 

          // Set up the client, then call next function 
          sdk.getTokensAuthorizationCodeGrant(authCode, null, function(err, tokenInfo) {
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
  const BOX_RAW_FOLDER_ID = "88879798045"; 
  const LOCAL_INPUT_FOLDER_PATH = path.join("extraResources", "OpenLabeling", "main", "input"); 
  
  document.getElementById("loginRedo").style.display = "none"; // Get rid of backup re-authenticate button 
  
  // clearInputDirectory();
  let root = document.getElementById("box_folder");
  client.folders.getItems(BOX_RAW_FOLDER_ID)
  .then(items => {
    console.log("Items: ", items);
    items.entries.forEach(item => {
      console.log("Downloading file " + item.name); 
      client.files.getReadStream(item.id, null, function(err, stream) {
        if (err) console.error("File Download Error", err);  
        stream.pipe(fs.createWriteStream(path.join(LOCAL_INPUT_FOLDER_PATH, item.name))); 
      }); 
    }); 
  }); 
}

async function removeChildrenOfElement(element) {
  var child = element.lastElementChild; 
  while (child) {
    element.removeChild(child); 
    child = element.lastElementChild;
  }
}

var rimraf = require("rimraf"); 
function clearInputDirectory() {
  // TODO: Figure out how the hell rimraf's input works, I can't do it for the life of me 
  rimraf.sync(path.join("extraResources", "OpenLabeling", "main", "input", "*")); 
}