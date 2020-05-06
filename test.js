// This file was just me testing to see if we could just import stuff from other files right away without worrying about module exports. 
// We can; It's pretty easy. I just haven't bothered because then you have to worry about what directory the JavaScript is actually
// running from, which can screw up stuff like relative paths. 

console.log(getZipName("videoName_24.mp4", [0, 3, 6, 11, 15, 19])); 
function getZipName(videoName, filledFrames) {

    // Just making sure video name is w/ the underscore and not something else 
    let endString = videoName.replace(".", "_"); 
  
    // Iterate through every pair of two 
    // This won't error b/c filledFrames is effectively guaranteed to be an even length 
    for (let i = 0; i < filledFrames.length; i += 2) {
      endString += "_"; 
      endString += filledFrames[i]; 
      endString += "_"; 
      endString += filledFrames[i + 1]; 
    }
  
    return endString; 
  }

const fs = require("fs"); //Load the filesystem module
const stats = fs.statSync("myfile.txt");
const fileSizeInBytes = stats.size;

console.log(fileSizeInBytes);
