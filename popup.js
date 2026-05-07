// popup.js - Popup script for Manifest V3

var settings;
var pageNo = 0;
var filterTimeOut;
var filterStrings;
var filterRegEx;
var currentTime;
var content;
var noTabs;
var tWidth, tWidth2, tWidth3;
var delType;
var longpress = false;
var lpdVal;
var chkArray;

// Initialize on popup load
document.addEventListener('DOMContentLoaded', async function() {
  // Load settings first
  const data = await chrome.storage.local.get('settings');
  settings = data.settings || {};
  
  delType = settings.style || 1;
  lpdVal = (settings.lpDelay || 3) * 1000;
  
  document.body.style.width = (settings.wPop || 300) + 'px';
  tWidth = (settings.wPop || 300) - 30 - 5;
  if (settings.sexy) tWidth -= 91;
  if (!settings.sexy && delType === 2) tWidth -= 28;
  tWidth2 = (settings.wPop || 300) - 28;
  
  chkArray = [];
  
  btnLangAdj();
  await setup();
  
  document.getElementById('clr').addEventListener('click', reset);
  document.getElementById('clr').title = chrome.i18n.getMessage("popup_clrbtn_tooltip");
  document.getElementById('clr').innerHTML = chrome.i18n.getMessage("popup_clrbtn");
  document.getElementById('searchQ').addEventListener('input', function() {
    searchFor(document.getElementById('searchQ').value);
  });
  document.getElementById('searchQ').title = chrome.i18n.getMessage("popup_search_tooltip");
  document.getElementById('delete').addEventListener('click', deleteFoundTabs);
  document.getElementById('delete').title = chrome.i18n.getMessage("popup_delbtn_tooltip");
  document.getElementById('delete').innerHTML = chrome.i18n.getMessage("popup_delbtn");
  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('prev').title = chrome.i18n.getMessage("popup_prvbtn_tooltip");
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('next').title = chrome.i18n.getMessage("popup_nxtbtn_tooltip");
  
  document.getElementById('open1').innerHTML = chrome.i18n.getMessage("popup_open1_btn");
  document.getElementById('open1').title = chrome.i18n.getMessage("popup_open1_tooltip");
  document.getElementById('open1').addEventListener('click', async function(e) {
    if (chkArray.length > 0) {
      for (var i = chkArray.length - 1; i >= 0; i--) {
        await createTab(chkArray[i], true);
      }
      window.close();
    }
  }, false);
  document.getElementById('open2').innerHTML = chrome.i18n.getMessage("popup_open2_btn");
  document.getElementById('open2').title = chrome.i18n.getMessage("popup_open2_tooltip");
  document.getElementById('open2').addEventListener('click', function(e) {
    chrome.windows.create(async function(newWin) {
      if (chkArray.length > 0) {
        for (var i = chkArray.length - 1; i >= 0; i--) {
          await createTabWindow(chkArray[i], newWin.id);
        }
        window.close();
      }
    });
  }, false);
  document.getElementById('delete2').innerHTML = chrome.i18n.getMessage("popup_delbtn");
  document.getElementById('delete2').title = chrome.i18n.getMessage("popup_delete2_tooltip");
  document.getElementById('delete2').addEventListener('click', async function(e) {
    if (chkArray.length > 0) {
      for (var i = chkArray.length - 1; i >= 0; i--) {
        await removeClosedTab(chkArray[i]);
      }
      chkArray = [];
      await setup();
    }
  }, false);
  document.getElementById('cancel').title = chrome.i18n.getMessage("popup_cancel_tooltip");
  document.getElementById('cancel').addEventListener('click', async function(e) {
    longpress = false;
    chkArray = [];
    await setup();
  }, false);
  
  await cleanInvalidTabs();
});

// Double click handler - send message to background
function dClickHandler() {
  if (!settings.disableDClick) {
    chrome.runtime.sendMessage("dclick");
  }
}

function createLink(id, url, pgTitle) {
  var link = document.createElement('a');
  var animate = "longpress " + (settings.lpDelay || 3) + "s";
  link.href = "javascript:void(0);";
  
  var presstimer = null;
  var longtarget = null;
  
  var cancel = function(e) {
    if (presstimer !== null) {
      clearTimeout(presstimer);
      presstimer = null;
    }
    this.style.animation = "none";
  };
  
  var click = async function(e) {
    if (presstimer !== null) {
      clearTimeout(presstimer);
      presstimer = null;
    }
    this.style.animation = "none";
    
    if (longpress) {
      return false;
    }
    
    if (e.button === 0) {
      await createTab(id, true);
      await setup();
    }
  };
  
  var mclick = async function(e) {
    if (e.button === 1) {
      await createTab(id, false);
      if (!settings.mClickClose) {
        await setup();
      } else {
        window.close();
      }
    }
  };
  
  var start = function(e) {
    longpress = false;
    
    if (e.button === 0) {
      this.style.animation = animate;
      presstimer = setTimeout(async function() {
        longpress = true;
        await setup();
      }, lpdVal);
    }
    
    return false;
  };
  
  link.addEventListener("mousedown", start);
  link.addEventListener("touchstart", start);
  link.addEventListener("click", click);
  link.addEventListener("auxclick", mclick);
  link.addEventListener("mouseout", cancel);
  link.addEventListener("touchend", cancel);
  link.addEventListener("touchleave", cancel);
  link.addEventListener("touchcancel", cancel);
  
  if (settings.tooltipText) {
    link.href = "javascript:void(0);";
    link.title = pgTitle;
  } else {
    link.title = url;
  }
  return link;
}

function encodeHtml(str) {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function setup() {
  content = document.getElementById("content");
  
  if (settings.menuTop === true) content = document.getElementById("content2");
  if (settings.boldFont === true) content.className += " bold";
  
  await populate();
  
  if (!noTabs && (settings.showSearch === true || settings.showClear === true || settings.numLimit > settings.numItems || longpress)) {
    document.getElementById("controls").style.display = "";
    
    if (settings.showSearch === false || longpress) {
      document.getElementById("searchholder").style.display = "none";
    } else {
      document.getElementById("searchholder").style.display = "";
    }
    if (settings.showClear === false || longpress) {
      document.getElementById("clrholder").style.display = "none";
    } else {
      document.getElementById("clr").style.display = "inline";
    }
    
    if (filterStrings != null) {
      document.getElementById("tailenders").className = "tailendersShow";
      document.getElementById("delete").style.display = "inline";
      document.getElementById("prev").style.display = "none";
      document.getElementById("next").style.display = "none";
      document.getElementById("clrholder").style.display = "none";
    } else {
      document.getElementById("delete").style.display = "none";
      if (settings.showClear && !longpress) document.getElementById("clrholder").style.display = "table-cell";
      document.getElementById("prev").style.display = "inline";
      document.getElementById("next").style.display = "inline";
    }
    
    if (!longpress) {
      document.getElementById("lpholder").style.display = "none";
    } else {
      document.getElementById("lpholder").style.display = "";
    }
  } else {
    document.getElementById("controls").style.display = "none";
  }
}

async function populate() {
  const data = await chrome.storage.local.get('ClosedTabIndex');
  var closedTabIndex = data.ClosedTabIndex || [];
  
  if (closedTabIndex.length === 0) {
    content.innerHTML = chrome.i18n.getMessage("popup_noTabsMsg");
    document.getElementById("controls").style.display = "none";
    noTabs = true;
  } else {
    noTabs = false;
    content.innerHTML = "";
    
    var disp_per_pg = settings.numItems || 10;
    if (filterStrings != null) disp_per_pg = 1000;
    
    currentTime = Date.now();
    
    // Load all closed tab data
    const allData = await chrome.storage.local.get(null);
    
    var i = closedTabIndex.length - 1;
    for (var j = 0; i >= 0 && j < pageNo * disp_per_pg; i--) {
      if (allData["ClosedTab-" + closedTabIndex[i]]) j++;
    }
    
    for (var j = 0; i >= 0 && j < disp_per_pg; i--) {
      var closedTab = allData["ClosedTab-" + closedTabIndex[i]];
      if (closedTab) {
        if (filterStrings == null || (filterStrings != null && closedTab.multiFind(filterStrings))) {
          createEntry(closedTabIndex[i], closedTab, allData);
          j++;
        }
      }
    }
    
    if (filterStrings == null) {
      document.getElementById("tailenders").className = "tailendersHide";
      document.getElementById("prev").style.visibility = "hidden";
      document.getElementById("next").style.visibility = "hidden";
      if (pageNo > 0) {
        document.getElementById("tailenders").className = "tailendersShow";
        document.getElementById("prev").style.visibility = "visible";
      }
      if (closedTabIndex.length > (pageNo + 1) * settings.numItems) {
        document.getElementById("tailenders").className = "tailendersShow";
        document.getElementById("next").style.visibility = "visible";
      }
    } else {
      if (j === 0) content.innerHTML = "<center>" + chrome.i18n.getMessage("popup_noSearchResult") + " '" + unescape(filterStrings.join(" ")) + "'</center>";
    }
  }
}

function createEntry(i, closedTab, allData) {
  var split = closedTab.split("|!|");
  var tabTime = split[0];
  var tabUrl = split[1];
  var tabTitle = encodeHtml(split[2]);
  
  var text_link = createLink(i, tabUrl, tabTitle);
  var html = "";
  var fragment = document.createDocumentFragment();
  
  // Use external favicon service for MV3 (chrome://favicon/ is deprecated)
  var faviconUrl = getFaviconUrl(tabUrl);
  html += "<img class=\"icon\" src=\"" + faviconUrl + "\" alt=\"" + tabUrl + "\">";
  
  if (filterStrings != null) tabTitle = tabTitle.multiReplace(filterStrings);
  
  html += "<div class=\"titleTxt";
  if (settings.numLines != 0 && !isNaN(settings.numLines) && filterStrings == null) html += " maxh" + settings.numLines + "";
  if (longpress && delType != 2 && !settings.sexy) {
    tWidth3 = tWidth - 28;
    html += "\" style=\"width:" + tWidth3 + "px\"> " + tabTitle + "</div>";
  } else if ((longpress || delType == 2) && settings.sexy) {
    tWidth3 = tWidth - 28;
    html += "\" style=\"width:" + tWidth3 + "px\"> " + tabTitle + "</div>";
  } else {
    html += "\" style=\"width:" + tWidth + "px\"> " + tabTitle + "</div>";
  }
  
  if (settings.showTime) {
    var spanClass = "nxtLine";
    if (settings.sexy) spanClass = "nxtLine smeLine delTxt";
    html += "<span class=\"" + spanClass + "\">" + getElapsedTime(currentTime - tabTime) + "</span>";
  }
  
  var itm = document.createElement("div");
  itm.innerHTML = html;
  
  if (!longpress) {
    if (delType == 1) {
      itm.className = "item";
      itm.appendChild(buildDelBtn(i));
      text_link.appendChild(itm);
      text_link.classList.add("link");
      content.appendChild(text_link);
    }
    if (delType == 2) {
      var itm2 = document.createElement("div");
      itm2.className = "item2";
      
      text_link.appendChild(itm);
      text_link.style.width = tWidth2 + "px";
      text_link.classList.add("classicExpand");
      itm2.appendChild(buildDelBtn(i));
      itm2.appendChild(text_link);
      content.appendChild(itm2);
    }
    if (delType == 3) {
      itm.className = "item";
      text_link.appendChild(itm);
      text_link.classList.add("link");
      content.appendChild(text_link);
    }
  } else {
    var itm3 = document.createElement("div");
    itm3.className = "item2";
    
    var chkbx = document.createElement("input");
    chkbx.type = "checkbox";
    chkbx.name = "deleteList";
    chkbx.value = i;
    chkbx.id = "cb-" + i;
    chkbx.className = "chkbx";
    var chkHandler = function(e) {
      var id = e.target.value;
      var alreadyIn = false;
      for (var i = chkArray.length - 1; i >= 0; i--) {
        if (chkArray[i] === id) {
          alreadyIn = true;
          chkArray.splice(i, 1);
        }
      }
      if (!alreadyIn) chkArray.push(id);
    };
    chkbx.addEventListener("click", chkHandler);
    chkbx.checked = findTabCBM(i);
    
    text_link.appendChild(itm);
    text_link.style.width = tWidth2 + "px";
    text_link.classList.add("classicExpand");
    
    itm3.appendChild(text_link);
    itm3.appendChild(chkbx);
    content.appendChild(itm3);
  }
}

// Get favicon URL - MV3 compatible method
function getFaviconUrl(tabUrl) {
  try {
    var url = new URL(tabUrl);
    // Use the website's favicon or Google's favicon service as fallback
    return "https://www.google.com/s2/favicons?domain=" + url.hostname + "&sz=16";
  } catch (e) {
    // If URL parsing fails, use a default
    return "icon-16.png";
  }
}

function buildDelBtn(i) {
  var fragment = document.createDocumentFragment();
  
  if (delType == 1) {
    var delBtn = document.createElement("div");
    delBtn.id = "del-" + i;
    delBtn.className = "del";
    delBtn.title = chrome.i18n.getMessage("popup_delbtn");
    delBtn.innerHTML = "<p class=\"delTxt\">&times;</p>";
    delBtn.addEventListener('click', async function(event) {
      event.stopPropagation();
      await removeClosedTab(i);
      await setup();
    }, false);
    delBtn.addEventListener('mousedown', function(event) {
      event.stopPropagation();
    });
    
    var delBg = document.createElement("div");
    delBg.className = "delBg";
    
    fragment.appendChild(delBtn);
    fragment.appendChild(delBg);
  }
  
  if (delType == 2) {
    var delBtn = document.createElement("div");
    delBtn.id = "del-" + i;
    delBtn.className = "del2";
    delBtn.title = chrome.i18n.getMessage("popup_delbtn");
    delBtn.innerHTML = "<p class=\"delTxt2\">&times;</p>";
    delBtn.addEventListener('click', async function(event) {
      event.stopPropagation();
      await removeClosedTab(i);
      await setup();
    }, false);
    
    fragment.appendChild(delBtn);
  }
  
  return fragment;
}

function searchFor(string) {
  string = string.replace(/(\%)/g, "%25");
  string = string.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
  string = stripVowelAccent(string);
  
  if ((filterStrings == null && string == "") || (filterStrings != null && string == filterStrings.join(" "))) return;
  
  if (string == "") {
    pageNo = 0;
    filterStrings = null;
  } else {
    pageNo = 0;
    string = string.toLowerCase();
    filterStrings = string.split(" ");
  }
  clearTimeout(filterTimeOut);
  filterTimeOut = setTimeout(setup, 200);
}

async function next() {
  const data = await chrome.storage.local.get('ClosedTabIndex');
  var closedTabIndex = data.ClosedTabIndex || [];
  if (closedTabIndex.length > (pageNo + 1) * settings.numItems) pageNo++;
  await setup();
}

async function prev() {
  if (pageNo > 0) pageNo--;
  await setup();
}

async function reset() {
  if (document.getElementById("searchQ").value != "") {
    document.getElementById("searchQ").value = "";
    searchFor("");
  } else {
    await resetData();
    pageNo = 0;
    await setup();
  }
}

async function deleteFoundTabs() {
  if (filterStrings == null) return;
  const allData = await chrome.storage.local.get(null);
  var closedTabIndex = allData.ClosedTabIndex || [];
  
  for (var i = closedTabIndex.length - 1; i >= 0; i--) {
    var closedTab = allData["ClosedTab-" + closedTabIndex[i]];
    if (closedTab) {
      if (filterStrings != null && closedTab.multiFind(filterStrings)) {
        await removeClosedTab(closedTabIndex[i]);
      }
    }
  }
  document.getElementById('searchQ').value = "";
  filterStrings = null;
  await setup();
}

function getElapsedTime(ms) {
  var text = "<b>";
  var s, min, h, days, x;
  x = ms / 1000;
  s = Math.floor(x % 60);
  x /= 60;
  min = Math.floor(x % 60);
  x /= 60;
  h = Math.floor(x % 24);
  x /= 24;
  days = Math.floor(x);
  
  if (days != 0) {
    text += days + " day";
    if (days > 1) text += "s";
  } else if ((h != 0 && h < 2) && min != 0) {
    text += h + "h " + min + "min ";
  } else if (h != 0) {
    text += h + "h ";
  } else if (min != 0) {
    text += min + "min ";
  } else if (s != 0) {
    text += s + "s ";
  } else {
    text += "0s ";
  }
  text += "</b> ago";
  
  return text;
}

async function cleanInvalidTabs() {
  const tabs = await chrome.tabs.query({ "url": "*://*/*" });
  const data = await chrome.storage.local.get('TabListIndex');
  var tabListIndex = data.TabListIndex || [];
  
  if (tabListIndex.length > tabs.length) {
    var tabsToClean = tabListIndex.length - tabs.length;
    var keysToRemove = [];
    for (var t = 0; t < tabsToClean; t++) {
      keysToRemove.push("TabList-" + tabListIndex[t]);
    }
    tabListIndex.splice(0, tabsToClean);
    await chrome.storage.local.remove(keysToRemove);
    await chrome.storage.local.set({ TabListIndex: tabListIndex });
  }
}

function findTabCBM(id) {
  var found = false;
  if (chkArray.length > 0) {
    for (var i = chkArray.length - 1; i >= 0; i--) {
      if (chkArray[i] === id) {
        found = true;
      }
    }
  }
  return found;
}

function stripVowelAccent(str) {
  var rExps = [
    /[\xC0-\xC2]/g, /[\xE0-\xE2]/g,
    /[\xC8-\xCA]/g, /[\xE8-\xEB]/g,
    /[\xCC-\xCE]/g, /[\xEC-\xEE]/g,
    /[\xD2-\xD4]/g, /[\xF2-\xF4]/g,
    /[\xD9-\xDB]/g, /[\xF9-\xFB]/g
  ];
  
  var repChar = ['A', 'a', 'E', 'e', 'I', 'i', 'O', 'o', 'U', 'u'];
  
  for (var i = 0, j = rExps.length; i < j; ++i)
    str = str.replace(rExps[i], repChar[i]);
  
  return str;
}

function btnLangAdj() {
  var lang = chrome.i18n.getUILanguage();
  if (lang == "ru") {
    document.getElementById('clr').style.width = "75px";
    document.getElementById('open1').style.fontSize = "8px";
    document.getElementById('open2').style.fontSize = "8px";
    document.getElementById('open2').style.padding = "0px 4px";
    document.getElementById('delete2').style.fontSize = "8px";
  }
  if (lang == "sr") {
    document.getElementById('open1').style.fontSize = "8px";
    document.getElementById('open1').style.padding = "0px 5px";
    document.getElementById('open2').style.fontSize = "8px";
    document.getElementById('open2').style.padding = "0px 5px";
    document.getElementById('delete2').style.fontSize = "8px";
    document.getElementById('delete2').style.padding = "0px 5px";
  }
}

// Helper functions for storage operations
async function createTab(id, selected) {
  const data = await chrome.storage.local.get("ClosedTab-" + id);
  var url = data["ClosedTab-" + id].split("|!|")[1];
  if (selected === true) {
    chrome.tabs.create({ "url": url, "active": true });
  } else {
    chrome.tabs.create({ "url": url, "active": false });
  }
  await removeClosedTab(id);
}

async function createTabWindow(id, wId) {
  const data = await chrome.storage.local.get("ClosedTab-" + id);
  var url = data["ClosedTab-" + id].split("|!|")[1];
  chrome.tabs.create({ "url": url, "windowId": wId });
  await removeClosedTab(id);
}

async function removeClosedTab(id) {
  const data = await chrome.storage.local.get('ClosedTabIndex');
  var closedTabIndex = data.ClosedTabIndex || [];
  closedTabIndex.splice(closedTabIndex.indexOf(id), 1);
  
  await chrome.storage.local.remove("ClosedTab-" + id);
  await chrome.storage.local.set({ ClosedTabIndex: closedTabIndex });
  
  // Notify background to update badge
  chrome.runtime.sendMessage({ action: 'updateBadge' });
}

async function resetData() {
  const data = await chrome.storage.local.get(["settings", "updatedTill"]);
  var settingsData = data.settings;
  var oldUpdTill = data.updatedTill;
  
  await chrome.storage.local.clear();
  
  await chrome.storage.local.set({
    settings: settingsData,
    updatedTill: oldUpdTill,
    TabListIndex: [],
    ClosedTabIndex: []
  });
  
  // Notify background to re-register tabs
  chrome.runtime.sendMessage({ action: 'regExistingTabs' });
}

// String prototype extensions
String.prototype.multiFind = function(strings) {
  var str = this, i;
  str = stripVowelAccent(str);
  str = str.toLowerCase();
  if (settings.searchMode != 3) {
    var splitStr = str.split("|!|");
    if (settings.searchMode == 1) str = splitStr[2];
    if (settings.searchMode == 2) str = splitStr[1];
  }
  var foundAmount = 0;
  for (i = 0, j = strings.length; i < j; i++) {
    if (str.indexOf(strings[i]) != -1) foundAmount++;
  }
  return (foundAmount == strings.length);
};

String.prototype.multiReplace = function(strings) {
  var str_real = this, i;
  var str = str_real;
  str = stripVowelAccent(str);
  str = str.toLowerCase();
  var position = -1;
  for (i = 0, j = strings.length; i < j; i++) {
    position = str.indexOf(strings[i]);
    if (position != -1) {
      str_real = str_real.substr(0, position) + "<u>" + str_real.substr(position, strings[i].length) + "</u>" + str_real.substr(position + strings[i].length);
      str = stripVowelAccent(str_real).toLowerCase();
    }
  }
  return str_real;
};

// Keyboard navigation
var selLink = -1;
document.onkeydown = function(evt) {
  evt = evt || window.event;
  if (evt.keyCode == 37 || evt.keyCode == 39) {
    if (evt.keyCode == 37) {
      prev();
    }
    if (evt.keyCode == 39) {
      next();
    }
  } else if (evt.keyCode == 38 || evt.keyCode == 40) {
    if (evt.keyCode == 38) {
      if (selLink > 0) selLink--;
      else selLink = (document.links.length - 1);
    }
    if (evt.keyCode == 40) {
      if (selLink < (document.links.length - 1)) selLink++;
      else selLink = 0;
    }
    document.links[selLink].focus();
  } else if (evt.keyCode == 13) {
    document.links[selLink].click();
  } else {
    document.getElementById('searchQ').focus();
  }
};