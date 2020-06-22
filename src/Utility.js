module.exports = {
  updateStatus: updateStatus, 
  clearDirectory: clearDirectory,
  resolveBaseDir: resolveBaseDir
}

function updateStatus(statusMessage) {
  document.getElementById("status").textContent = "Status: " + statusMessage;
}

// Performs `rm -rf` at the given file path 
var rimraf = require("rimraf");
var path = require("path");
function clearDirectory(filePath) {
  console.debug("Deleting everything in directory " + filePath);
  rimraf.sync(path.join(filePath, "*"));
  console.debug("Deleted everything in directory " + filePath);
}

// This function returns a path to our base directory, sensing whether we're in development or distribution
// This is necessary for stuff to work properly when we're in a built version of the app, rather than just `yarn start` (development version)
function resolveBaseDir() {
  if (process.resourcesPath.endsWith("Scylla/node_modules/electron/dist/resources")) {
    console.log("We are in the development environment!");
    return __dirname;
  } else {
    console.log("We are in the distribution environment!");
    return path.join(process.resourcesPath);
  }
}