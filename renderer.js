

// Called from a HTML Button's onClick 
function launchOpenLabeling() {
    
  const { PythonShell } = require("python-shell");

  // TODO: Figure out how to get this running from a portable copy of Python that comes running from within the app, rather than using a user-wide Python install. I think you can probably just include a portable Python install inside this folder structure, and the compilation software we are probably using (electron-forge) handles bundling all folders automatically.   
  // pythonPath needs manually set here; Can't find it if you try and do it automatically 
  let options = {
    mode: 'text',
    pythonPath: '/usr/bin/python', // TODO: Figure out how to get this running 
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
function moveFilesToOpenLabeling() {
  console.log.bind(console.log);

  // Each element in here has a .name and a .path (absolute) property that 
  // we can use to move it via the fs module 
  files = document.getElementById("localFileInput").files; 

  // TODO: Copy all files currently in the input directory into the filebackup directory
  // TODO: Remove all files currently in the input directory 
  // TODO: Copy all files that were selected into the input directory 
}