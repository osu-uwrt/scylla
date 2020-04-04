
const fs = require("fs"); //Load the filesystem module
const stats = fs.statSync("myfile.txt");
const fileSizeInBytes = stats.size;

console.log(fileSizeInBytes);