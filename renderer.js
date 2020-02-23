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

/*
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
      console.debug(
        "(" +
          (i + 1) +
          "/" +
          files.length +
          ") Copying file/folder " +
          files[i] +
          " over to '/filebackup'."
      );

      // Copy whatever it is over recursively
      ncp(
        path.join(inputDirPath, files[i]),
        path.join(__dirname + "/filebackup", files[i]),
        err => {
          if (err) {
            console.error(
              "Unable to copy file from /input to /filebackup: " + err
            );
            return;
          }
        }
      );
    }

    // Delete all files in the input directory
    for (let i = 0; i < files.length; i++) {
      // Debug Output
      console.debug(
        "(" +
          (i + 1) +
          "/" +
          files.length +
          ") Deleting file/folder " +
          files[i] +
          " from '/input'."
      );

      rimraf(path.join(inputDirPath, files[i]), err => {
        if (err) {
          console.error("Unable to delete folder in /input: " + err);
          return;
        }
      });

      /* If rimraf doesn't end up deleting files and not just filders, use this code to handle individual files: 
      // Otherwise, use normal fs.unlink because it works for regular files
      else {
        fs.unlink(path.join(inputDirPath, files[i]), (err) => {
          if (err) { return console.error("Unable to delete file in /input: " + err); }
        })
      } 
    }
  });

  // * Copy our selected files into OpenLabeling's input directory
  // Each element in here has a .name and a .path (absolute) property that
  // we can use to move it via the fs module
  files = document.getElementById("localFileInput").files;
  for (let i = 0; i < files.length; i++) {
    // Debug Output
    console.debug(
      "(" +
        (i + 1) +
        "/" +
        files.length +
        ") Copying file/folder " +
        files[i] +
        " to '/input'."
    );
    console.log(JSON.stringify(files[i].path));

    ncp(
      files[i].path,
      path.join(__dirname + "/../OpenLabeling/main/input", files[i].name),
      err => {
        if (err) {
          console.error(
            "Unable to copy file from /input to /filebackup: " + err
          );
          return;
        }
      }
    );
  }
}
*/

function authenticateIntoBox() {

  var debugStream = fs.createWriteStream("debug.txt"); 

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

  // Checks every 10ms if the user has logged in yet 
  var hasSignedIn = false;
  const timeout = () => {
    setTimeout(function() {
      console.log("Current authWindow URL: " + authWindow.webContents.getURL()); 
      if (authWindow.webContents.getURL().substring(0, 22) === "https://www.google.com") {        
        hasSignedIn = true;
        authWindow.close();
        window.location.href = 'boxing.html';
      } else {
        console.log(authWindow.webContents.getURL())
        timeout();
      }
    }, 10);
  };

  timeout();

  // var request = require("request");

  // var options = {
  //   method: "GET",
  //   url: "https://osu.app.box.com/folder/88879798045"
  // };

  // request(options, function(error, response, body) {
  //   if (error) throw new Error(error);

  //   console.log(body);
  //   // load the box auth url in a pop up window
  //   authWindow.loadURL("https://osu.app.box.com/folder/88879798045");
  //   authWindow.show();
  // });
}
