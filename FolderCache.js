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
      items: <Result of client.folders.getItems(id)>
      info: <Result of client.folders.get(id)>
    }
  }
*/

let cachedPages = new Map();  

function folderIsCached(id) {
  return cachedPages.has(id);
}

function addItemsToCache(id, items) {

  console.log("Adding items for id " + id + " to cache.");

  // If we already have some sort of object linked to the id, we modify that one and set it. Otherwise we modify an empty object and set it. 
  let obj = folderIsCached(id) ? cachedPages.get(id) : {}; 
  obj.items = items; 
  cachedPages.set(id, obj); 
}

function addInfoToCache(id, info) {

  console.log("Adding info for id " + id + " to cache.");

  // If we already have some sort of object linked to the id, we modify that one and set it. Otherwise we modify an empty object and set it. 
  let obj = folderIsCached(id) ? cachedPages.get(id) : {}; 
  obj.info = info; 
  cachedPages.set(id, obj); 
}

function getPageItems(id) {

  // Technically a precondition b/c we theoretically never call this on non-cached folders but here to be sure 
  if (!folderIsCached(id)) {
    console.error("Tried to get non-cached folder from cache!");
    return -1; 
  }

  return cachedPages.get(id).items;
}

function getPageInfo(id) {

  // Technically a precondition b/c we theoretically never call this on non-cached folders but here to be sure 
  if (!folderIsCached(id)) {
    console.error("Tried to get non-cached folder from cache!");
    return -1; 
  }

  return cachedPages.get(id).info; 
}

module.exports = {
  addItemsToCache: addItemsToCache, 
  addInfoToCache: addInfoToCache, 
  folderIsCached: folderIsCached, 
  getPageItems: getPageItems, 
  getPageInfo: getPageInfo
}

