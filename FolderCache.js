// We do a lot of network requests. 
// If the user goes back on their selection, we'd rather not do the same network request twice, seeing as it isn't a very big object we're grabbing. 
// So, we can essentially just store the network requests we've done so far in variables, and link them to the folder ID. 
// Then, whenever we go to grab a folder, we first check this cache to see if that data already exists in a variable rather than doing the network request again. 
// This won't help with folders the user has never opened yet, but that'll be improved when I implement prefetching (anticipate where the user will go next and download it ahead of time)
// Map ends up being a cleaner implementation than an array b/c we don't care about order. Gets rid of a lot of iteration. 

/* Structure (as a map): 
  {
    key: id, 
    value: {
      id: <The id of the folder> 
      items: <Result of client.folders.getItems(id)>
      info: <Result of client.folders.get(id)>
    }
  }
*/

let cachedPages = new Map();  

function folderIsCached(id) {
  return cachedPages.has(id);
}

function addOrUpdateFolderToCache(pId, pInfo, pItems) {
  
  console.log("Adding or updating folder " + pInfo.name + " to cache.");
  let obj = { id: pId, info: pInfo, items: pItems }; 
  cachedPages.set(pId, obj);  
}

function getFolder(id) {

  // Technically a precondition b/c we theoretically never call this on non-cached folders but here to be sure 
  if (!folderIsCached(id)) {
    console.error("Tried to get non-cached folder from cache!");
    return -1; 
  }

  return cachedPages.get(id);
}

/* Allows us to "lock" a folder id.
  If it shows up in here, a network request is either currently out for that folder id, or that the folder is already cached. */ 
let lockedIds = new Set(); 

function lockId(id) {

  // Theoretically we never try and lock a folder that's already locked, but here for redundancy 
  if (lockedIds.has(id)) {
    console.error("Tried to lock a file that was already locked!"); 
  }

  lockedIds.add(id); 
}

function unlockId(id) {
  
  if (!lockedIds.has(id)) {
    console.error("Tried to unlock a file that wasn't locked!"); 
  }

  lockedIds.delete(id); 
}

function idIsLocked(id) {
  return lockedIds.has(id); 
}


module.exports = {
  addOrUpdateFolderToCache: addOrUpdateFolderToCache, 
  folderIsCached: folderIsCached, 
  getFolder: getFolder,
  lockId: lockId, 
  unlockId: unlockId, 
  idIsLocked: idIsLocked
}

