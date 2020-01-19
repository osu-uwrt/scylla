// Used to find files instead of using relative directories... Our packaging system and Python-Shell REALLY like to screw with paths and this 
// is the only way I can think of to make it consistently work 
var glob = require("glob");

// TODO: Improve debugging completeness and give more useful feedback (easiest to do while building, not afterwards) 
// Called from a HTML Button's onClick 
function launchOpenLabeling() {
    
  const { PythonShell } = require("python-shell");  

  // glob.sync returns an array with those files, but there's only ever one file with that name, so we index the first element 
  PythonShell.run(glob.sync("OpenLabeling/main/main.py")[0], null, function (err, results) {
    if (err) throw err;
    console.log('results: %j', results);
  });
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

  const inputDirPath = glob.sync("../OpenLabeling/main/input")[0];
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

    ncp(files[i].path, path.join(__dirname + "/../OpenLabeling/main/input", files[i].name), (err) => {
      if (err) { 
        console.error("Unable to copy file from /input to /filebackup: " + err);
        return;
      }
    })

  }
}

// TODO: Implement this (I don't have an exact idea how this works, so you'll need to do some research, but it'll take a bit of time to understand and implement)
function authenticateIntoBox() {

}