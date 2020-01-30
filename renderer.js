const glob = require("glob");
const electron = require('electron');
const path = require("path");
var process = require("process");
var spawn = require("child_process").spawn;

// Called from HTML onClick 
function launchOpenLabeling() {
  
  // Launching process uisng child_process module 
  var mainPath = path.join("OpenLabeling", "main", "main.py");
  var olProcess = spawn("/usr/bin/python3", [path.join(__dirname, "..", mainPath)]);

  // Debug streams, essentially
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => { console.log("Child process exited with code " + code + "."); });
}

// Files = Absolute file paths to each file 
// This method copies over all the passed-in files to 
// OpenLabeling's startup file 
// To make sure nothing is accidentally deleted, this will 
// copy the files into a folder called backup/ in the
function moveFilesToOpenLabeling() {   

  console.log.bind(console.log);

  // Needed for any operations having to do with the local computer's file system 
  const fs = require("fs");
  const path = require("path");
  const ncp = require("ncp").ncp; // Required for folder copying 
  const rimraf = require("rimraf"); // Required for recursive folder deletion

  // * Back Up, then delete all files currently in the '/input' directory 
  // Reading in the contents of that directory 
  console.debug("Backing up all files currently in '/input' to '/filebackup'.");

  console.log("Current Directory: " + __dirname); 
  console.log("Trying to find the ./OpenLabeling/main/input directory.");
  const inputDirPath = glob.sync("OpenLabeling/main/input")[0];
  fs.readdirSync(inputDirPath, (err, files) => {
    
    if (err) { 
      console.error("Unable to read directory: " + err);  
      return; 
    }
    
    // "files" is an array with each file name
    for (let i = 0; i < files.length; i++) {

      // Debug Output 
      console.debug("(" + (i + 1) + "/" + files.length + ") Copying file/folder " + files[i] + " over to '/filebackup'.");

      // Copy whatever it is over recursively 
      ncp(path.join(inputDirPath, files[i]), path.join(__dirname + "/filebackup", files[i]), (err) => {
        if (err) { 
          console.error("Unable to copy file from /input to /filebackup: " + err);
          return;
        }
      })
    }

    // Delete all files in the input directory 
    for (let i = 0; i < files.length; i++) {

      // Debug Output 
      console.debug("(" + (i + 1) + "/" + files.length + ") Deleting file/folder " + files[i] + " from '/input'.");

      rimraf(path.join(inputDirPath, files[i]), (err) => {
        if (err) {
          console.error("Unable to delete folder in /input: " + err); 
          return;
        }
      })

      /* If rimraf doesn't end up deleting files and not just filders, use this code to handle individual files: 
      // Otherwise, use normal fs.unlink because it works for regular files
      else {
        fs.unlink(path.join(inputDirPath, files[i]), (err) => {
          if (err) { return console.error("Unable to delete file in /input: " + err); }
        })
      } */
    }    
  });   

  // * Copy our selected files into OpenLabeling's input directory 
  // Each element in here has a .name and a .path (absolute) property that 
  // we can use to move it via the fs module 
  files = document.getElementById("localFileInput").files; 
  for (let i = 0; i < files.length; i++) {

    // Debug Output 
    console.debug("(" + (i + 1) + "/" + files.length + ") Copying file/folder " + files[i] + " to '/input'.");
    console.log(JSON.stringify(files[i].path));

    console.log("Current Directory: " + __dirname);
    ncp(files[i].path, path.join(__dirname + "/../OpenLabeling/main/input", files[i].name), (err) => {
      if (err) { 
        console.error("Unable to copy file from /input to /filebackup: " + err);
        return;
      }
    })

  }
}

function authenticateIntoBox() {
  // add box package made for node
  var BoxSDK = require("box-node-sdk")

  // create a broser pop up window for auth
  const BrowserWindow = electron.remote.BrowserWindow;
  var authWindow = new BrowserWindow({
    width: 800, 
    height: 600, 
    show: false, 
    'node-integration': false,
    'web-security': false
  });

  // generate the box auth url
  var sdk = new BoxSDK({
    clientID: "aywbmb0o8m80ixdybgv2qerjuduh7g9r",
    clientSecret: "FhysbMfni0A2ZBu1DJ4VtexP4TzJkmR9"
  });
  var authorize_url = sdk.getAuthorizeURL({
    response_type: "code"
  });

// load the box auth url in a pop up window
authWindow.loadURL(authorize_url);
authWindow.show();

}