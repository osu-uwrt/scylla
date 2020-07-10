/* Array of Objects w/ following structure: 
    {
        fileID: Number, 
        nameOfFile: String s
    }
*/
var itemsToBox = []; 

// Use id instead of name b/c id is unique whereas name isn't guaranteed to be
// (kind of a useless distinction b/c OpenLabeling can't really handle identically 
// named files regardless but this is just generally better practice)
function idIsInQueue(id) {
    for (let i = 0; i < itemsToBox.length; i++) {
        if (id === itemsToBox[i].fileID) {
            return true; 
        }
    }
    return false;
}

function removeFromQueue(id) {
    for (let i = 0; i < itemsToBox.length; i++) {
        if (itemsToBox[i].fileID === id) {
            itemsToBox.splice(i, 1); // Not storing result in anything, we don't care about removed values
            return;
        }
    }
    console.error("Tried to remove an ID from the boxing queue that wasn't there!");
}

function addToQueue(name, id) {
  console.log("Adding following object to Boxing queue: ", { nameOfFile: name, fileID: id });
    itemsToBox.push({ nameOfFile: name, fileID: id });
}

function processNewItem(name, id) {
    
    // If it's already in the queue, remove it 
    if (idIsInQueue(id)) {
        removeFromQueue(id); 
    }

    // Otherwise, if it's not already in the queue, add it 
    else {
        addToQueue(name, id); 
    }

    updateScreenQueue();
}

/* My initial thought was that fully wiping and re-rendering would be less 
    efficient than adding and removing one by one as they were actually 
    clicked on... but to remove, you'd have to do a search regardless, 
    which is still O(n), and this is all going to take fractions of a 
    second anyway, so this is just the less complicated, fully functional
    way to do it. */ 
function updateScreenQueue() {

    // Grab a reference and get rid of whatever was there before 
    let boxingQueue = document.getElementById("boxingQueue");
    while (boxingQueue.lastChild) { boxingQueue.innerHTML = ""; }

    for (let i = 0; i < itemsToBox.length; i++) {
        let node = document.createElement("li");
        node.textContent = itemsToBox[i].nameOfFile; 
        boxingQueue.appendChild(node);
    }
}

function getAllIDs() {
    let arr = []; 
    for (let i = 0; i < itemsToBox.length; i++) {
        arr.push(itemsToBox[i].fileID);
    }
    return arr; 
}

// Electron (More specifically, node) can only handle CommonJS modules, not ES6
module.exports = {
    itemsToBox: itemsToBox, 
    idIsInQueue: idIsInQueue, 
    removeFromQueue: removeFromQueue, 
    addToQueue: addToQueue, 
    processNewItem: processNewItem, 
    getAllIDs: getAllIDs
}

