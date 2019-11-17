// TODO: Improve debugging completeness and give more useful feedback (easiest to do while building, not afterwards) 
// Called from a HTML Button's onClick 
function launchOpenLabeling() {
    
  const { PythonShell } = require("python-shell");

  // TODO: Figure out how to get this running from a portable copy of Python that comes running from within the app, rather than using a user-wide Python install. I think you can probably just include a portable Python install inside this folder structure, and the compilation software we are probably using (electron-forge) handles bundling all folders automatically.   
  // pythonPath needs manually set here; Can't find it if you try and do it automatically 
  let options = {
    mode: 'text',
    pythonPath: '/usr/bin/python',
    pythonOptions: ['-u'], // get print results in real-time
    scriptPath: './OpenLabeling/main',
  };
  
  PythonShell.run('main.py', options, function (err, results) {
    if (err) throw err;

    // results is an array consisting of messages collected during execution
    console.log('results: %j', results);
  });
}

// Files = Absolute file paths to each file 
// This method copies over all the passed-in files to 
// OpenLabeling's startup file 
// To make sure nothing is accidentally deleted, this will 
// copy the files into a folder called backup/ in the 
moveFilesToOpenLabeling();
function moveFilesToOpenLabeling() {   

  console.log.bind(console.log);

  // Needed for any operations having to do with the local computer's file system 
  const fs = require("fs");
  const path = require("path");
  const ncp = require("ncp").ncp; // Required for folder copying 
  const rimraf = require("rimraf"); // Required for recursive folder deletion

  // * "Backing up" all files in the current input directory so they aren't permanently lost. This is here incase the user needs those files. 
  // Reading in the contents of that directory 
  console.debug("Backing up all files currently in '/input' to '/filebackup'.");
  const inputDirPath = path.join(__dirname, "/OpenLabeling/main/input");
  fs.readdir(inputDirPath, (err, files) => {
    
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

    // TODO: Copy all files that were selected into the input directory L
    // Each element in here has a .name and a .path (absolute) property that 
    // we can use to move it via the fs module 
    //files = document.getElementById("localFileInput").files; 
    for (let i = 0; i < files.length; i++) {

      // Debug Output 
      console.debug("(" + (i + 1) + "/" + files.length + ") Copying file/folder " + files[i] + " to '/input'.");

      ncp(path.join(files[i].path, files[i].name), path.join(__dirname + "/input", files[i]), (err) => {
        if (err) { 
          console.error("Unable to copy file from /input to /filebackup: " + err);
          return;
        }
      })

    }
  });   
}

// TODO: Implement this (I don't have an exact idea how this works, so you'll need to do some research, but it'll take a bit of time to understand and implement)
function authenticateIntoBox() {

}