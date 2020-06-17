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
// TODO: Either rename this, or change overall class functionality to remove ambiguity 
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

    // Actually go up that one id 
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
  for (let i = 0; i < folderPath.length; i++) { 

    // Element that we actually put the folder id in 
    let filePathText = document.createElement("div");
    filePathText.classList.toggle("filePathText");
    filePathText.textContent = folderPath[i].name; 
    filePathText.addEventListener("click", () => {
      shrinkArrToId(folderPath[i].id); 
      displayFolder(folderPath[i].id);
    });

    // Base list element that we'll append to 
    let li = document.createElement("li");
    li.classList.toggle("filePathEntry");
    li.appendChild(filePathText); 

    // If it's not the last one, add the carat in between
    // A css solution would probably be cleaner, but last-of-type doesn't work because each carat object is in a different <li> element
    if (i + 1 < folderPath.length) {
      let carat = document.createElement("div"); 
      carat.classList.toggle("carat"); 
      carat.textContent = ">"; 
      li.appendChild(carat);
    }

    // Append it to our overall list 
    root.appendChild(li); 
  }
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
  refreshHTML();
}

// Fills our representation based on the first folder we open
async function fillFromBaseFolder(id) {

  // Wait for the network requests that give us our current folder's information 
  let folder = await getFolder(id); 
  FolderCache.addFolderToCache(folder.id, folder.info, folder.items); 
  folderPath.unshift({ id: folder.id, name: folder.info.name }); 

  if (folder.info.parent !== null) {
    fillFromBaseFolder(folder.info.parent.id); 
  } else {
    refreshHTML(); 
  }
}

function precacheFolder(folder) {
  folder.items.entries.forEach(item => {
    if (item.type === "folder") {
      getFolder(item.id); 
    }
  });
}

// Returns object with items, id, and info for a specific folder. 
// Will handle locking and caching whatever it gets 
// By design, does NOT handle precaching or rendering. If we want to do precaching we'd have to do a lot of weird stuff to avoid only recursing one level, and rendering doesn't belong here because we have a lot of cases (i.e. precaching) where we just want to get folder information, not necessarily put it up on screen. 
function getFolder(id) {

  // If it's cached, get from folder, otherwise if it isn't locked (meaning a request is in the works) do the request 
  return new Promise(resolve => {    
    if (FolderCache.folderIsCached(id)) {
      resolve(FolderCache.getFolder(id)); 
    } else if (!FolderCache.idIsLocked(id)) {
      FolderCache.lockId(id); 
      Promise.all([client.folders.get(id), client.folders.getItems(id)])
      .then(arr => {
        FolderCache.addFolderToCache(id, arr[0], arr[1]); 
        resolve({ id: id, info: arr[0], items: arr[1] }); 
      });
    }
    else {
      resolve(); 
    }
  }); 
}

async function displayFolder(id) {

  // If this is the very first folder we are opening, update that before we open the page 
  if (folderPath.length === 0) {

    // Fill our base tree and precache all our parents up to root 
    await fillFromBaseFolder(id); 

    // Do everything for our base folder (if there isn't already a separate request out there for it) 
    let folder = await getFolder(id); 
    if (folder === null) {
      return; 
    }

    precacheFolder(await getFolder(id));    
    displayResultsOfNetworkRequest(folder.items); 
    return; 
  }

  // Otherwise, it's a normal folder that we handle normally 
  // Get actual folder contents and start precaching the contents of it 
  let folder = await getFolder(id);

  // If it's null here that means there was another network request going on and we should get out of here
  if (folder === null) {
    return;
  }

  precacheFolder(folder); 

  // Update the class's record of what the current folder looks like 
  currentFolder.info = folder.info; 
  currentFolder.items = folder.items; 

  // Actually render everything 
  displayResultsOfNetworkRequest(folder.items); 
}

// Gritty HTML DOM stuff to display the items object 
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