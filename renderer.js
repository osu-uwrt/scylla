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

// ! THIS METHOD ISN'T FINISHED YET

// Files = Absolute file paths to each file 
// This method copies over all the passed-in files to 
// OpenLabeling's startup file 
// To make sure nothing is accidentally deleted, this will 
// copy the files into a folder called backup/ in the 
// ! As currently written, this only performs correctly for local files. 
function moveFilesToOpenLabeling() {
  console.log.bind(console.log);

  // Each element in here has a .name and a .path (absolute) property that 
  // we can use to move it via the fs module 
  //files = document.getElementById("localFileInput").files; 

  // Needed for any operations having to do with the local computer's file system 
  const fs = require("fs");
  const path = require("path");

  // TODO: Copy all files currently in the input directory into the filebackup directory
  // * "Backing up" all files in the current input directory so they aren't permanently lost. This is here incase the user needs those files. 
  // Reading in the contents of that directory 
  console.debug("Backing up all files currently in '/input' to '/filebackup'.");
  const inputDirPath = path.join(__dirname, "/OpenLabeling/main/input");
  fs.readdir(inputDirPath, (err, files) => {
    
    if (err) { 
      return console.err("Unable to read directory: " + err);  
    }
    
    // "files" is an array with each file name
    files.forEach((file) => {

      console.debug("Copying file " + file + " over to '/filebackup'.");
      fs.copyFile(path.join(inputDirPath, file), path.join(__dirname + "/filebackup", file), (err) => {
        return console.error("Unable to copy file from /input to /filebackup: " + err);
      })
    })
  });

  // TODO: Remove all files currently in the input directory
  // TODO: Copy all files that were selected into the input directory L
}