// Each folder's information from the request gives a folder id of the parent, which is really all we need to actually navigate...
// But it's kind of a buggy system right now and I'd rather have something more formalized because 
// I want to be able to present the user with "hey, you are down this exact file path" similar to how box itself actually does it. 

// This file needs to basically 
// (1) Display the full folder path to a folder with any given ID. We will need to call this right after authentication in, because we want to be able to start from any folder. 
// (2) Keep track of an ordered list whenever the user navigates, appending and removing from it, rather than doing the above every time. This essentially functions as a stack. 

/* Format: 
  Each array entry is an object with the following: 
  {
    id: String, // ID of the folder
    name: String // Name of the folder 
  }
*/
let folderPath = []; 

function addFolderToPath(id, name) {
  folderPath.push({ id: id, name: name });
}

// Generally called whenever we're moving up a folder... prunes the last folder
function removeFolderFromPath() {
  folderPath.pop(); 
}

// Goes from the folder, goes up a level, goes up a level, etc. until it gets to the top, filling in our object the whole way.
// Adds elements at the beginning every time. I could reverse the array every time but then every time I wanted to add/remove from the "end" I would face the same problem. 
// So, if I do it this way, I only have to do the inoptimal "insert at beginning" one time through rather than every time I navigate. 
// Making this recursive was the smoothest way to do it; While loops and asynchronous network calls are hard to make work together, especially if you don't want them to be blocking.
function fillFromBaseFolder(id, client) {
  
  // Get the current folder's information
  client.folders.get(id) 
  .then(info => {

    // Append it to the beginning of the queue 
    folderPath.unshift({ id: id, name: info.name });

    // If it has a parent, recursively call on the parent 
    if (info.parent !== null) {
      fillFromBaseFolder(info.parent.id); 
    }
  });
}

// Essentially just our main "getter" - I'd rather do it the Java / OOP way than make the variable itself effectively public
// (It's javascript and it's a global so it's already technically out there, but you get what I mean.) 
function getCurrentPath() {
  return folderPath;
}

module.exports = {
  addFolderToPath: addFolderToPath, 
  removeFolderFromPath: removeFolderFromPath, 
  fillFromBaseFolder: fillFromBaseFolder, 
  getCurrentPath: getCurrentPath
}