// Each folder's information from the request gives a folder id of the parent, which is really all we need to actually navigate...
// But it's kind of a buggy system right now and I'd rather have something more formalized because 
// I want to be able to present the user with "hey, you are down this exact file path" similar to how box itself actually does it. 

/* Needs the following functionality: 
  - At app launch, it needs to reconstruct the file path to the first one at the very beginning. 
  - Whenever the user goes up a level, simply prune the heirarchy by one folder level and refresh the html with our representation. 
  - Whenever the user goes into a folder in the current one, push that as a new one and refresh the html with our representation. 
  - Whenever the user clicks on a folder somewhere in the folder path, prune our representation to that point, display our folder, and refresh the html with our representation. 
*/

module.exports = {
  getBoxingQueue: getBoxingQueue, 
  setClient: setClient, 
  fillFromBaseFolder: fillFromBaseFolder, 
  displayFolder: displayFolder
}

// Necessary imports 
var FolderCache = require("./FolderCache");
var BoxingQueue = require("./BoxingQueue");

// Due to how this is organized, need to offer a way for the main file to get BoxingQueue stuff from this file 
function getBoxingQueue() {
  return BoxingQueue.getAllIDs(); 
}

// Client is technically global, but we need an instance of it here.
var client; 
function setClient(clientParam) {
  client = clientParam; 
}

// Tracks (references to) info object and items object of currently opened folder 
var currentFolder = {}; 

/* Format: 
  Each array entry is an object with the following: 
  {
    id: String, // ID of the folder
    name: String // Name of the folder 
  }
*/
let folderPath = []; 

// Right click anywhere in the heirarchy takes you up one level 
document.getElementById("baseOfMyTree").addEventListener("contextmenu", () => {
  
  // If current page has a parent, adjust representation and render parent
  if (currentFolder.info.parent !== null) {
    oneFolderUp(); 
    displayFolder(currentFolder.info.parent.id);
  }
});

// Updates the HTML display to reflect whatever our representation says our current state is 
function refreshHTML() {

  // Grab a reference and clear what was already there
  let root = document.getElementById("currentFilePath");
  while (root.lastChild) { 
    root.removeChild(root.lastChild); 
  }

  // Iterate through each entry that we have 
  folderPath.forEach(elem => {

    // Element that we actually put the folder id in 
    let filePathText = document.createElement("div");
    filePathText.classList.toggle("filePathText");
    filePathText.textContent = elem.name; 
    filePathText.addEventListener("click", () => {
      shrinkArrToId(elem.id); 
      displayFolder(elem.id)
    });
    
    // Spaces stuff out by a little bit 
    let carat = document.createElement("div"); 
    carat.textContent = " > "; 

    // Base list element that we'll append to 
    let li = document.createElement("li");
    li.classList.toggle("filePathEntry");
    li.appendChild(filePathText); 
    li.appendChild(carat); 

    // Append it to our overall list 
    root.appendChild(li); 
  }); 
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
function fillFromBaseFolder(id) {

  return new Promise(resolve => {
    // Get the current folder's information
    client.folders.get(id) 
    .then(info => {

      // Append to beginning of queue and unshift 
      folderPath.unshift({ id: id, name: info.name });

      // If it has a parent, recursively call on the parent 
      if (info.parent !== null) {
        resolve(fillFromBaseFolder(info.parent.id)); 
      } else {
        resolve(""); 
        // Means we got to top level... Nothing special to do here other than update the HTML
        refreshHTML();
      }
    });
  }) 
}

async function displayFolder(id) {

  // If this is the very first folder we are opening, update that before we open the page 
  if (folderPath.length === 0) {
    await fillFromBaseFolder(id); 
  }

  // Already cached = Don't do a network request 
  if (FolderCache.folderIsCached(id)) {

    // Update current page records 
    currentFolder.info = FolderCache.getPageInfo(id); 
    currentFolder.items = FolderCache.getPageItems(id); 

    // Actually render the page
    let folderItems = FolderCache.getPageItems(id); 
    displayResultsOfNetworkRequest(folderItems);
  }

  // Otherwise, we network request for it 
  // There's no need to do any actual code until we get both the info and the items. You could technically make a case for a very minor performance increase but these all take completely negligible amounts of time. 
  else {
  client.folders.get(id).then(fInfo => {
    client.folders.getItems(id).then(fItems => {

        // Update this "module"'s record of current page stuff
        currentFolder.info = fInfo; 
        currentFolder.items = fItems; 

        // Add to cache
        FolderCache.addFolderToCache(id, fItems, fInfo); 
        
        // Actually do the rendering based off of the items we found 
        displayResultsOfNetworkRequest(fItems);
      });    
    });  
  }
}

function displayResultsOfNetworkRequest(items) {

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
        oneFolderDown(items.entries[i].id, items.entries[i].name); 
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