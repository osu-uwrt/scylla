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

// Called from HTML onClick 
// TODO: Lots of debug statements in here, get rid of them in "final" app version 

// TODO: This will be in a different file at some point. It works, but we'll need 
// TODO: to figure out which renderer process it should be in, essentially.  
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
