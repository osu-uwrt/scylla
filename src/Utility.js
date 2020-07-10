let baseDir = require("electron").remote.app.getAppPath()

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

module.exports = {
  updateStatus: updateStatus, 
  clearDirectory: clearDirectory,
  baseDir: baseDir
}