const { PythonShell } = require("python-shell");

// Called from a HTML Button's onClick 
function launchOpenLabeling() {
    
    // Needs manually set b/c otherwise it tries to run the Python module
    // out here instead of in OpenLabeling, then can't find cv2 (opencv) 
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