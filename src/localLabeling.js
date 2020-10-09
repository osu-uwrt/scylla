//General Dependencies
const electron = require('electron');
const dialog = electron.remote.dialog;

//OpenLabeling
const path = require("path");
var fs = require("fs");
var spawn = require("child_process").spawn;

//Other custom JS files that we want code from
var { baseDir, updateStatus, clearDirectory } = require("./Utility");

//Webpage Elements
const selectFilesBtn = document.getElementById("selectFilesButton");
const startBtn = document.getElementById("startButton");
const outputPathBtn = document.getElementById("outputPathButton");
const clearBtn = document.getElementById("clearButton");

//*Global Variables
var files = [];
const userDataDir = (electron.app || electron.remote.app).getPath("userData");
const OL_INPUT_FOLDER = path.join(userDataDir, "input");
var OL_OUTPUT_FOLDER = "";
const classListLocation = path.join(userDataDir, "class_list.txt")
console.log("OL_INPUT_FOLDER: " + OL_INPUT_FOLDER); 

//Button press events
selectFilesBtn.addEventListener("click", function() {
  //This opens file explorer and allows user to select files. No duplicate files are allowed
  dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'], 
      filters: [
        {name: "Images", extensions: ['jpg', 'png', 'jpeg']},
        {name: "Videos", extensions: ['avi', 'mp4', "MOV", "MP4"]}
      ]
    }).then(result => {
    console.log(result.filePaths);
    for (i = 0; i < result.filePaths.length; i++) {
      if (!files.includes(result.filePaths[i])) {
        files.push(result.filePaths[i]);
        console.log(files);
      }
    }
    if (files.length == 0) {
      outputPathBtn.style.display = "none";
    } else {
      outputPathBtn.style.display = null;
    }
  });
});

clearBtn.addEventListener("click", function() {
  //Clear files and output directory
  files = [];
  OL_OUTPUT_FOLDER = "";
  startBtn.style.display = "none";
  outputPathBtn.style.display = "none";
});

outputPathBtn.addEventListener("click", function() {
  //This opens file explorers and allows user to select output directory
  dialog.showOpenDialog({properties: ['openDirectory']}).then(result => {
    console.log(result.filePaths);
    if ((OL_OUTPUT_FOLDER == "") && (!result.canceled)) {
       OL_OUTPUT_FOLDER = path.join(result.filePaths.join(), "output");
       console.log(OL_OUTPUT_FOLDER);
    } else if (!result.canceled) {
      OL_OUTPUT_FOLDER = "";
      OL_OUTPUT_FOLDER = path.join(result.filePaths.join(), "output");
      console.log(OL_OUTPUT_FOLDER);
    }
    if (files != null) {
      startBtn.style.display = null;
    } else {
      startBtn.style.display = "none";
    }
  });
});

startBtn.addEventListener("click", function() {
  baseDir = require("electron").remote.app.getAppPath();
  //Make needed directories and clear existing files
  if (!fs.existsSync(path.join(userDataDir, "input"))) {
    fs.mkdirSync(path.join(userDataDir, "input"));
  }
  if (!fs.existsSync(OL_OUTPUT_FOLDER)) {
    fs.mkdirSync(OL_OUTPUT_FOLDER);
  }
  if (!fs.existsSync(path.join(userDataDir, "ZipFiles"))) {
    fs.mkdirSync(path.join(userDataDir, "ZipFiles"));
  }
  if(!fs.existsSync(path.join(baseDir, "src", "OpenLabeling", "main", "input"))) {
    fs.mkdir(path.join(baseDir, "src", "OpenLabeling", "main", "input"));
  }  
  clearDirectory(OL_INPUT_FOLDER);
  clearDirectory(OL_OUTPUT_FOLDER);

  //Log file information, IO folders, and base directory
  console.log(files);
  console.log("baseDir: " + baseDir);
  console.log("OL_INPUT_FOLDER: " + OL_INPUT_FOLDER); 
  console.log("OL_OUTPUT_FOLDER: " + OL_OUTPUT_FOLDER);
  
  updateStatus("Moving all the files...");
  //Add selected files to input folder
  for (let i = 0; i < files.length; i++) {
    var indexSlash = files[i].lastIndexOf("/");
    var indexPeriod = files[i].lastIndexOf(".");
    console.log(files[i]);
    console.log("Writing this file to " + path.join(OL_INPUT_FOLDER, files[i].substr(indexSlash, indexPeriod)));
    var readStream = fs.createReadStream(files[i]);
    var writeStream = fs.createWriteStream(path.join(OL_INPUT_FOLDER, files[i].substr(indexSlash, indexPeriod)));
    readStream.pipe(writeStream);
  }
  launchOpenLabeling(baseDir);
});

async function launchOpenLabeling(baseDir) {

  updateStatus("Launching OpenLabeling.");

  //clearDirectory(path.join(OL_OUTPUT_FOLDER, "../")); // Get rid of everything inside the output directory. Our actual output directory is the YOLO_darknet subset, so we want one up from that
  clearDirectory(path.join(userDataDir, "ZipFiles"));

  // Figuring out where we launch OpenLabeling from
  var OLMainFilePath = path.resolve(path.join(baseDir, "src", "OpenLabeling", "main", "main.py"));
  console.log("Launching OpenLabeling from path " + OLMainFilePath);

  const PythonPath = "/usr/bin/python";
  console.log("Using python interpreter located at " + PythonPath);

  // Actually spawning the process and setting up listeners for all its streams
  // First element of array always has to be file to launch, then any flags onto python itself, then any other arguments
  var olProcess = spawn(PythonPath, [
    "-u", // Don't buffer output
    OLMainFilePath, // Actual file we're executing
    "-i", path.join(userDataDir, "input"), // Pass in input directory 
    "-o", path.join(OL_OUTPUT_FOLDER), // Pass in output directory 
    classListLocation, // Because we can't modify the actual app directory, I modified OpenLabeling to use one we pass in 
    baseDir ]); // Needed for OpenLabeling to locate site_packages
  olProcess.stdout.on("data", (chunk) => { console.log("stdout: " + chunk); });
  olProcess.stderr.on("data", (chunk) => { console.log("stderr: " + chunk); });
  olProcess.on("close", (code) => {
    console.log("Child process exited with code " + code + ".");
  });
} 