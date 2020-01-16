// TODO: Improve debugging completeness and give more useful feedback (easiest to do while building, not afterwards) 
// Called from a HTML Button's onClick 
function launchOpenLabeling() {
    
  const { PythonShell } = require("python-shell");  
  // TODO: Figure out how to get this running from a portable copy of Python that comes running from within the app, rather than using a user-wide Python install. I think you can probably just include a portable Python install inside this folder structure, and the compilation software we are probably using (electron-forge) handles bundling all folders automatically.   
  // pythonPath needs manually set here; Can't find it if you try and do it automatically 
  let options = {
    mode: 'text',
    scriptPath: "OpenLabeling/main",
    pythonOptions: ['-u'], // get print results in real-time
  };
  
  PythonShell.run('main.py', options, function (err, results) {
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
  const inputDirPath = path.join(__dirname, "../OpenLabeling/main/input");
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
  const BoxSDK = require("box-node-sdk");
  var sdk = new BoxSDK({
    clientID: "htdo6u39nl1w1l9dbrsjx7xcn5g6orgq",
    clientSecret: "2fMpdtdanrLSIh08nGNjodO7gR661Ud4"
  });

  var authorize_url = sdk.getAuthorizeURL({
    response_type: "code"
  });
  res.redirect(authorize_url)
  

}