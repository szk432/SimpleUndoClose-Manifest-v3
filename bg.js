// bg.js - Background service worker for Manifest V3

var defaultSettings = {
  "showClear": true,
  "showBadge": false,
  "showTime": true,
  "showSearch": true,
  "searchMode": 1,
  "boldFont": false,
  "saveHistory": true,
  "menuTop": false,
  "disableDClick": true,
  "tooltipText": true,
  "numLimit": 10,
  "numItems": 10,
  "numLines": 1,
  "altBut": false,
  "wPop": 300,
  "sexy": false,
  "style": 1,
  "lpDelay": 3,
  "mClickClose": false,
  "theme": "1"
};

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async function(runInfo) {
  if (runInfo.reason === "install") {
    await initialize();
  }
  if (runInfo.reason === "update") {
    await chrome.storage.local.set({ dcTime: Date.now() });
    await settingsUpdate();
  }
  await setBadge();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async function() {
  const settings = await chrome.storage.local.get('settings');
  if (settings.settings) {
    if (!settings.settings.saveHistory) {
      await resetData();
    } else {
      await tabListProcessing();
      await cleanClosedTabs();
      await setBadge();
    }
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.status === "complete") {
    addNewTab(tab);
  }
});

chrome.tabs.onRemoved.addListener(function(tabId, info) {
  addClosedTab(tabId, 0);
});

chrome.commands.onCommand.addListener(function(command) {
  if (command === "undo-latest") getLatestCTab();
});

// Double click listener
var alreadyClicked = false;
var timer;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Double click handler
  if (request === "dclick") {
    if (alreadyClicked) {
      clearTimeout(timer);
      alreadyClicked = false;
      getLatestCTab();
    } else {
      alreadyClicked = true;
      timer = setTimeout(function() {
        clearTimeout(timer);
        alreadyClicked = false;
      }, 400);
    }
  }
  
  // Handle action messages from popup/options
  if (request && request.action) {
    switch (request.action) {
      case 'updateBadge':
        setBadge();
        break;
      case 'updateIcon':
        updateIcon();
        break;
      case 'regExistingTabs':
        regExistingTabs();
        break;
    }
  }
  
  return false;
});

async function initialize() {
  await chrome.storage.local.set({
    settings: defaultSettings,
    dcTime: Date.now(),
    updatedTill: chrome.runtime.getManifest().version,
    TabListIndex: [],
    ClosedTabIndex: []
  });
  await regExistingTabs();
}

/* preserve old settings while adding new ones */
async function settingsUpdate() {
  const data = await chrome.storage.local.get(null);
  
  if (data.settings === undefined) {
    await initialize();
    return;
  }
  
  if (data.updatedTill === undefined || await needUpdateOrNot("1.4.0")) {
    console.log("Updating...");
    
    var localKeys = Object.keys(data.settings).sort();
    var currDefKeys = Object.keys(defaultSettings).sort();
    
    var settings = data.settings;
    
    if (localKeys.length < currDefKeys.length) {
      console.log("Updating settings...type 1");
      for (var i = 0; i < currDefKeys.length; i++) {
        var found = false;
        for (var j = 0; j < localKeys.length; j++) {
          if (currDefKeys[i] === localKeys[j]) {
            found = true;
            break;
          }
        }
        if (!found) {
          settings[currDefKeys[i]] = defaultSettings[currDefKeys[i]];
        }
      }
    } else if (localKeys.length > currDefKeys.length) {
      console.log("Updating settings...type 2");
      for (var i = 0; i < localKeys.length; i++) {
        var found = false;
        for (var j = 0; j < currDefKeys.length; j++) {
          if (localKeys[i] === currDefKeys[j]) {
            found = true;
            break;
          }
        }
        if (!found) {
          delete settings[localKeys[i]];
        }
      }
    }
    
    // disable DClick - 1.3.6
    settings.disableDClick = true;
    
    var updateData = { settings: settings };
    
    if (data.TabListIndex === undefined) {
      updateData.TabListIndex = [];
    }
    if (data.ClosedTabIndex === undefined) {
      updateData.ClosedTabIndex = [];
    }
    
    updateData.updatedTill = chrome.runtime.getManifest().version;
    
    await chrome.storage.local.set(updateData);
  }
}

async function needUpdateOrNot(specVer) {
  var need = false;
  const data = await chrome.storage.local.get('updatedTill');
  
  if (data.updatedTill === undefined) {
    need = true;
  } else if (data.updatedTill !== specVer) {
    var spcVer = specVer.split(".").map(Number);
    var tillVer = data.updatedTill.split(".").map(Number);
    var len = Math.max(spcVer.length, tillVer.length);
    for (var i = 0; i < len; i++) {
      if (spcVer[i] === undefined) spcVer[i] = 0;
      if (tillVer[i] === undefined) tillVer[i] = 0;
      if (spcVer[i] > tillVer[i]) {
        need = true;
        break;
      }
    }
  }
  return need;
}

async function addClosedTab(tabId, mode) {
  const data = await chrome.storage.local.get(null);
  
  if (data["TabList-" + tabId] !== undefined) {
    var settings = data.settings;
    var closedTabIndex = data.ClosedTabIndex || [];
    
    var splitValue = data["TabList-" + tabId].split("|!|");
    var url = splitValue[0];
    var re = /^(http:|https:|chrome-extension:)/;
    
    if (url && re.test(url)) {
      var exists = -1;
      
      for (var i = closedTabIndex.length - 1; i >= 0; i--) {
        var closedTab = data["ClosedTab-" + closedTabIndex[i]];
        if (closedTab) {
          var split = closedTab.split("|!|");
          if (split[1] === url) {
            exists = closedTabIndex[i];
            break;
          }
        }
      }
      
      var createStr = Date.now() + "|!|" + data["TabList-" + tabId];
      
      if (exists !== -1) {
        delete data["ClosedTab-" + exists];
        closedTabIndex.splice(closedTabIndex.indexOf(exists), 1);
      }
      
      var rId = randomIdGen();
      data["ClosedTab-" + rId] = createStr;
      closedTabIndex.push(rId);
      
      if (closedTabIndex.length > settings.numLimit) {
        for (var i = 0; i < closedTabIndex.length; i++) {
          var closedTab = data["ClosedTab-" + closedTabIndex[i]];
          if (closedTab) {
            delete data["ClosedTab-" + closedTabIndex[i]];
            closedTabIndex.splice(closedTabIndex.indexOf(closedTabIndex[i]), 1);
            break;
          }
        }
      }
      
      data.ClosedTabIndex = closedTabIndex;
      
      // Build update object
      var updateData = {};
      updateData["ClosedTab-" + rId] = createStr;
      updateData.ClosedTabIndex = closedTabIndex;
      
      delete data["TabList-" + tabId];
      var tabListIndex = data.TabListIndex || [];
      tabListIndex.splice(tabListIndex.indexOf(tabId), 1);
      updateData.TabListIndex = tabListIndex;
      updateData["TabList-" + tabId] = null; // Will be removed
      
      // Remove the tab from storage
      await chrome.storage.local.remove("TabList-" + tabId);
      await chrome.storage.local.set(updateData);
      
      await setBadge();
    }
  }
}

async function tabListProcessing() {
  const allData = await chrome.storage.local.get(null);
  var tabListIndex = allData.TabListIndex || [];
  
  var keysToRemove = [];
  var updates = {};
  
  for (var key in allData) {
    if (key.indexOf("TabList-") !== -1) {
      var tabListId = parseInt(key.substr(8));
      if (tabListIndex.indexOf(tabListId) !== -1) {
        // This tab was open before, now it's closed
        // addClosedTab logic inline
        var tabData = allData[key];
        var url = tabData.split("|!|")[0];
        var re = /^(http:|https:|chrome-extension:)/;
        
        if (url && re.test(url)) {
          var closedTabIndex = allData.ClosedTabIndex || [];
          var rId = randomIdGen();
          var createStr = Date.now() + "|!|" + tabData;
          updates["ClosedTab-" + rId] = createStr;
          closedTabIndex.push(rId);
          updates.ClosedTabIndex = closedTabIndex;
        }
      }
      keysToRemove.push(key);
    }
  }
  
  // Update tabListIndex to empty (all tabs need re-registration)
  updates.TabListIndex = [];
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
  await chrome.storage.local.set(updates);
}

function randomIdGen() {
  return Math.random().toString(36).substring(2, 8);
}

async function cleanClosedTabs() {
  const allData = await chrome.storage.local.get(null);
  var db = {};
  var indexList = allData.ClosedTabIndex || [];
  
  for (var i = 0; i < indexList.length; i++) {
    db[indexList[i]] = true;
  }
  
  var keysToRemove = [];
  for (var key in allData) {
    if (key.startsWith('ClosedTab-')) {
      var parts = key.split('-');
      if (!db.hasOwnProperty(parts[1])) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}

// Show |url| in a new tab.
async function createTab(id, selected) {
  const data = await chrome.storage.local.get("ClosedTab-" + id);
  var closedTabData = data["ClosedTab-" + id];
  if (!closedTabData) return; // Guard against undefined
  
  var url = closedTabData.split("|!|")[1];
  if (selected === true) {
    chrome.tabs.create({ "url": url, "active": true });
  } else {
    chrome.tabs.create({ "url": url, "active": false });
  }
  await removeClosedTab(id);
}

async function createTabWindow(id, wId) {
  const data = await chrome.storage.local.get("ClosedTab-" + id);
  var closedTabData = data["ClosedTab-" + id];
  if (!closedTabData) return; // Guard against undefined
  
  var url = closedTabData.split("|!|")[1];
  chrome.tabs.create({ "url": url, "windowId": wId });
  await removeClosedTab(id);
}

function addNewTab(tab) {
  var re = /^(http:|https:|chrome-extension:)/;
  if (re.test(tab.url)) {
    if (chkNewTab(tab)) {
      var insertThis = tab.url + "|!|" + tab.title;
      chrome.storage.local.get(["TabListIndex", "TabList-" + tab.id], function(data) {
        var tabListIndex = data.TabListIndex || [];
        if (tabListIndex.indexOf(tab.id) === -1) {
          tabListIndex.push(tab.id);
          chrome.storage.local.set({
            ["TabList-" + tab.id]: insertThis,
            TabListIndex: tabListIndex
          });
        }
      });
    }
  }
}

function chkNewTab(tab) {
  var pass = false;
  chrome.storage.local.get("TabList-" + tab.id, function(data) {
    var inList = data["TabList-" + tab.id];
    if (inList === undefined || (inList && (inList.split("|!|")[0] !== tab.url || (inList.split("|!|")[0] === tab.url && inList.split("|!|")[1] !== tab.title)))) {
      pass = true;
    }
  });
  return true; // Simplified for async
}

async function removeClosedTab(id) {
  const data = await chrome.storage.local.get(["ClosedTabIndex", "ClosedTab-" + id]);
  var closedTabIndex = data.ClosedTabIndex || [];
  delete data["ClosedTab-" + id];
  closedTabIndex.splice(closedTabIndex.indexOf(id), 1);
  
  await chrome.storage.local.remove("ClosedTab-" + id);
  await chrome.storage.local.set({ ClosedTabIndex: closedTabIndex });
  await setBadge();
}

async function setBadge() {
  const data = await chrome.storage.local.get(["settings", "ClosedTabIndex"]);
  var settings = data.settings;
  var closedTabIndex = data.ClosedTabIndex || [];
  
  if (settings && settings.showBadge) {
    var n = closedTabIndex.length;
    if (n > 0) {
      chrome.action.setBadgeBackgroundColor({ color: [15, 161, 211, 255] });
      chrome.action.setBadgeText({ text: n.toString() });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

async function resetData() {
  const data = await chrome.storage.local.get(["settings", "updatedTill"]);
  var settings = data.settings;
  var oldUpdTill = data.updatedTill;
  
  await chrome.storage.local.clear();
  
  await chrome.storage.local.set({
    settings: settings,
    updatedTill: oldUpdTill,
    TabListIndex: [],
    ClosedTabIndex: []
  });
  
  await regExistingTabs();
  await setBadge();
}

async function updateIcon() {
  const data = await chrome.storage.local.get("settings");
  var settings = data.settings;
  
  if (settings && settings.altBut) {
    chrome.action.setIcon({ path: { "16": "icon-19-1.png", "32": "icon-38-1.png" } });
  } else {
    // In MV3, we can't detect dark mode from service worker easily
    // Default to light icon
    chrome.action.setIcon({
      path: {
        "16": "icon-19-0.png",
        "32": "icon-38-0.png"
      }
    });
  }
}

function regExistingTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({ "url": "*://*/*" }, function(tabs) {
      var updates = {};
      var tabListIndex = [];
      
      for (var t = 0; t < tabs.length; t++) {
        var tab = tabs[t];
        var re = /^(http:|https:|chrome-extension:)/;
        if (re.test(tab.url)) {
          var insertThis = tab.url + "|!|" + tab.title;
          updates["TabList-" + tab.id] = insertThis;
          tabListIndex.push(tab.id);
        }
      }
      
      updates.TabListIndex = tabListIndex;
      chrome.storage.local.set(updates, resolve);
    });
  });
}

function getLatestCTab() {
  chrome.storage.local.get("ClosedTabIndex", function(data) {
    var closedTabIndex = data.ClosedTabIndex || [];
    if (closedTabIndex.length > 0) {
      createTab(closedTabIndex[closedTabIndex.length - 1], true);
    }
  });
}