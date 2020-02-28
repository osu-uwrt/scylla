const electron = require('electron'); 
var BoxSDK = require("box-node-sdk"); // Interface w/ Box API

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

  const PATH_MARKER_FOLDER_ID = "100533349334"; 
  console.log("Client Object: ", client);

  // Get rid of the backup button that re-triggers authentication, seeing as we've authenticated correctly  
  document.getElementById("loginRedo").style.display = "none";
  
  let root = document.getElementById("box_folder");

  client.folders.get(PATH_MARKER_FOLDER_ID)
  .then(folder => {
    removeChildrenOfElement(root);
    console.log("Folder Object: ");
    console.log(folder); 

    document.getElementById("box_folder").remove
    for (let i = 0; i < folder.item_collection.entries.length; i++) {
      let item = document.createElement("div"); 
      let text = folder.item_collection.entries[i].name; 
      item.appendChild(document.createTextNode(text)); 
      item.classList.toggle("box_item");
      root.appendChild(item);
    }
  });  
}

async function removeChildrenOfElement(element) {
  var child = element.lastElementChild; 
  while (child) {
    element.removeChild(child); 
    child = element.lastElementChild;
  }
}