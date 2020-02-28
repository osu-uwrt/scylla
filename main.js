// Imports 
const { app, BrowserWindow, ipcMain } = require('electron');

// Used to share the client object between webpages 
ipcMain.on("setBoxClientObj", (event, boxClientObjValue) => {
  global.boxClientObj = boxClientObjValue; 
});

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

  win.loadFile('./startup.html');  
  win.maximize();
});