// General Dependencies 
const electron = require('electron'); 
const { ipcRenderer, remote } = require("electron");
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

          // window.location.href = "box.html";
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
  console.log("Client Object: ", client);

  // Get rid of the backup button that re-triggers authentication 
  document.getElementById("loginRedo").style.display = "none";

  // TODO: Actually do stuff with this client! 

  /*
  // General Dependencies 
  const electron = require('electron');
  const PATH_MARKER_FOLDER_ID = "100533349334"; 

  client.users.get(client.CURRENT_USER_ID)
  .then(user => console.log("Hello " + user.name + "!"))
  .catch(err => console.log("Error: " + err)); 

  client.folders.get(PATH_MARKER_FOLDER_ID)
  .then(folder => {
    console.log("Folder Object: ");
    console.log(folder); 
  });
  */
}