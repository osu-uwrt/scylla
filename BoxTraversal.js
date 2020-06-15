// Each folder's information from the request gives a folder id of the parent, which is really all we need to actually navigate...
// But it's kind of a buggy system right now and I'd rather have something more formalized because 
// I want to be able to present the user with "hey, you are down this exact file path" similar to how box itself actually does it. 

/* Needs the following functionality: 
  - At app launch, it needs to reconstruct the file path to the first one at the very beginning. 
  - Whenever the user goes up a level, simply prune the heirarchy by one folder level and refresh the html with our representation. 
  - Whenever the user goes into a folder in the current one, push that as a new one and refresh the html with our representation. 
  - Whenever the user clicks on a folder somewhere in the folder path, prune our representation to that point, display our folder, and refresh the html with our representation. 
*/

// Necessary imports 
var FolderCache = require("./FolderCache");

/* Format: 
  Each array entry is an object with the following: 
  {
    id: String, // ID of the folder
    name: String // Name of the folder 
  }
*/
let folderPath = []; 

// Updates the HTML display to reflect whatever our representation says our current state is 
function refreshHTML() {

}

// Modifies our representation to reflect going one folder up in the Box heirarchy 
function oneFolderUp() {
  folderPath.pop(); 
  refreshHTML(); 
}

// Modifies our representation to reflect going one folder "down" (i.e. going into a folder) in the Box heirarchy 
function oneFolderDown(id, name) {
  folderPath.push({ id: id, name: name });
  refreshHTML(); 
}

function shrinkArrToId(id) {
  let atRightLevel = false; 
  while (!atRightLevel) {
    let removed = folderPath.pop(); 
    if (removed.id === id) {
      folderPath.push(removed);
      atRightLevel = true;
    }
  }
}

// Fills our representation based on the first folder we open
function fillFromBaseFolder(id, client) {
  
  // Get the current folder's information
  client.folders.get(id) 
  .then(info => {

    // Append to beginning of queue and unshift 
    folderPath.unshift({ id: id, name: info.name });

    // If it has a parent, recursively call on the parent 
    if (info.parent !== null) {
      fillFromBaseFolder(info.parent.id); 
    } else {
      // Means we got to top level... Nothing special to do here other than not recurse.
    }
  });
}

// Mode = context tracking; We want to change our representation only in certain places that we call this.
// 0 = Initial Load To Program. Means we have to create our representation from scratch. 
// 1 = Went Up One Folder Level. Means we have to prune our representation by one level. 
// 2 = Went In One Folder Level. Means we have to append something to our representation. 
// 3 = Selected some level up from the file tree. Means we have to prune our representation to the passed-in id. 
function displayFolder(id, mode) {

  // If it's already cached, don't worry about the network request 
  if (FolderCache.folderIsCached(id)) {
    
    // Update parent 
    let folderInfo = FolderCache.getPageInfo(id); 
    if (folderInfo.parent === null) {
      parentFolderID = null; 
    } else {
      parentFolderId = folderInfo.parent.id; 
    }

    // Add it to our component that tracks the overall file path to this point 
    BoxFilePathTracker.addFolderToPath(id, folderInfo.name); 

    // Update page display 
    let folderItems = FolderCache.getPageItems(id); 
    displayResultsOfNetworkRequest(folderItems);
  }

  else {
    // Otherwise, we do the network request and put it in the cache when we get it 
  client.folders.get(id) 
  .then(fInfo => {

    // Add folder information to cache 
    FolderCache.addInfoToCache(id, fInfo); 

    // Update parent folder id 
    if (fInfo.parent === null) {
      console.log("Current folder has no parent.");
      parentFolderID = null;
    } else {
      console.log("Successfully updated parent folder cache.");
      parentFolderID = fInfo.parent.id;
    }

    // Retrieve actual folder contents so we can render them 
    client.folders.getItems(id)
      .then(fItems => {

        // Add folder items to cache 
        FolderCache.addItemsToCache(id, fItems);
        displayResultsOfNetworkRequest(fItems);
      });    
    });  
  }
}

function displayResultsOfNetworkRequest(items) {

  console.log("Displaying following object: ", items);

  // Get reference to base and get rid of last folder we rendered
  let baseOfTree = document.getElementById("baseOfMyTree");
  while (baseOfTree.lastChild) { baseOfTree.removeChild(baseOfTree.lastChild); }

  // Iterate through each file and display it
  for (let i = 0; i < items.entries.length; i++) {

    // You can't bbox a folder
    if (items.entries[i].type !== "folder") {
      var boxItemEnableButton = document.createElement("div");
      boxItemEnableButton.classList.toggle("boxItemEnableButton");
    }

    let boxItemText = document.createElement("div");
    boxItemText.classList.toggle("boxItemText");
    boxItemText.textContent = items.entries[i].name; 

    let boxItem = document.createElement("li");
    boxItem.classList.toggle("boxItem");
    if (items.entries[i].type !== "folder") { boxItem.appendChild(boxItemEnableButton); } // Variable is only in scope if it isn't a folder
    boxItem.appendChild(boxItemText);

    // If it's a folder
    if (items.entries[i].type === "folder") {

      // If it's a folder, we add an onclick to it that will perform the next network request
      boxItem.onclick = function() {
        displayFolder(items.entries[i].id);
      }
    }

    // Otherwise, it's a viable file to bbox 
    else {

      // If it's currently already in the queue, we render the button as green 
      if (BoxingQueue.idIsInQueue(items.entries[i].id)) {
        boxItem.firstChild.classList.toggle("selectedToBox");
      }      

      // It's a viable file to bbox, so we give it an onclick 
      boxItem.onclick = function() {

        BoxingQueue.processNewItem(items.entries[i].name, items.entries[i].id);

        // Make the button green 
        boxItem.firstChild.classList.toggle("selectedToBox");
      }
    }

    baseOfTree.appendChild(boxItem);
  }
}

module.exports = {
  addFolderToPath: addFolderToPath, 
  removeFolderFromPath: removeFolderFromPath, 
  fillFromBaseFolder: fillFromBaseFolder, 
  getCurrentPath: getCurrentPath
}