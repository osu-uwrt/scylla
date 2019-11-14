// Imports 
const { app, BrowserWindow } = require('electron')
const { PythonShell } = require("python-shell");

//* Useful Links: 
// Python-Shell Documentation: https://github.com/extrabacon/python-shell

// When everything's loaded and "ready", create and render the window 
app.on('ready', () => 
{
  // Create browser window
  let win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true // Allows Node features in the DOM, basically 
    }
  })

  win.loadFile('./frontend/startup.html')
  win.maximize();
});