const MENU_ID = "toggle-enable";
const FLOAT_MENU_ID = "toggle-float";
const GUIDE_MENU_ID = "open-guide";

const DEFAULT_SETTINGS = {
  isPaused: false,
  isFloating: false,
  vToggle: false,
  vSpeed: 0,
  hToggle: false,
  hSpeed: 0,
  navToggle: false,
  navPos: 'right',
  navInterval: 5,
  padToggle: false,
  padVActive: false,
  padHActive: false,
  padClickActive: false,
  padStick: 'left',
  padSens: 15,
  activeTab: 'v-tab'
};

async function getTabState(tabId) {
  const result = await chrome.storage.local.get(`tabState_${tabId}`);
  if (result[`tabState_${tabId}`]) {
    return result[`tabState_${tabId}`];
  }
  return {
    isEnabled: false,
    isPaused: false,
    isFloating: false,
    userSettings: { ...DEFAULT_SETTINGS }
  };
}

async function setTabState(tabId, state) {
  await chrome.storage.local.set({ [`tabState_${tabId}`]: state });
}

chrome.runtime.onInstalled.addListener((details) => {
  initializeExtension(false, false);
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
  }
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtension(false, false);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const state = await getTabState(tabId);
    if (state.isEnabled) {
      state.isPaused = true;
      state.userSettings.isPaused = true;
      await setTabState(tabId, state);
      updateUIForTab(tabId);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`tabState_${tabId}`);
});

function initializeExtension(isEnabled, isFloating) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: isEnabled ? "Disable ScrollSync" : "Enable ScrollSync",
      contexts: ["action", "page"]
    });
    chrome.contextMenus.create({
      id: FLOAT_MENU_ID,
      title: isFloating ? "Hide Floating Controls" : "Show Floating Controls",
      contexts: ["action", "page"]
    });
    chrome.contextMenus.create({
      id: GUIDE_MENU_ID,
      title: "View Operational Manual",
      contexts: ["action", "page"]
    });
    updateBadge(isEnabled);
  });
}

function updateBadge(isEnabled) {
  const text = isEnabled ? "" : "OFF";
  const color = isEnabled ? "#00f0ff" : "#ff003c";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

async function updateUIForTab(tabId) {
  const state = await getTabState(tabId);
  updateBadge(state.isEnabled);
  chrome.contextMenus.update(MENU_ID, {
    title: state.isEnabled ? "Disable ScrollSync" : "Enable ScrollSync"
  });
  chrome.contextMenus.update(FLOAT_MENU_ID, {
    title: state.isFloating ? "Hide Floating Controls" : "Show Floating Controls"
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateUIForTab(activeInfo.tabId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || tab.id < 0) return;
  const state = await getTabState(tab.id);

  if (info.menuItemId === MENU_ID) {
    state.isEnabled = !state.isEnabled;
    await setTabState(tab.id, state);
    updateUIForTab(tab.id);
    chrome.tabs.sendMessage(tab.id, { 
        action: "stateChanged", 
        isEnabled: state.isEnabled 
    }).catch(() => {});
  } else if (info.menuItemId === FLOAT_MENU_ID) {
    state.isFloating = !state.isFloating;
    state.userSettings.isFloating = state.isFloating;
    await setTabState(tab.id, state);
    updateUIForTab(tab.id);
    chrome.tabs.sendMessage(tab.id, { 
        action: "floatChanged", 
        isFloating: state.isFloating 
    }).catch(() => {});
  } else if (info.menuItemId === GUIDE_MENU_ID) {
    chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // SECURITY: Strict Origin Validation
  if (sender.id !== chrome.runtime.id) {
    console.error("Unauthorized message origin detected:", sender.id);
    return false;
  }

  const tabId = sender.tab ? sender.tab.id : request.tabId;
  
  if (request.action === "openPopup") {
    // Open a dedicated popup window (the "try hard" fix)
    chrome.windows.create({
        url: chrome.runtime.getURL('index.html'),
        type: 'popup',
        width: 320,
        height: 580,
        top: 100,
        left: 100
    });
    sendResponse({ status: "opened" });
    return false;
  }

  if (request.action === "openGuide") {
    chrome.tabs.create({ url: chrome.runtime.getURL('guide.html') });
    sendResponse({ status: "opened" });
    return false;
  }

  if (!tabId || tabId < 0) {
    sendResponse({ status: "error", message: "Invalid Tab ID" });
    return false;
  }

  (async () => {
    const state = await getTabState(tabId);

    if (request.action === "getState") {
      sendResponse(state);
    } else if (request.action === "updateState") {
      state.isEnabled = request.isEnabled;
      state.isPaused = request.isPaused;
      state.isFloating = request.userSettings.isFloating || false;
      state.userSettings = request.userSettings;
      await setTabState(tabId, state);
      updateUIForTab(tabId);
      sendResponse({ status: "updated" });
    } else if (request.action === "togglePause") {
      state.isPaused = request.isPaused;
      state.userSettings.isPaused = request.isPaused;
      await setTabState(tabId, state);
      chrome.runtime.sendMessage({ action: "pauseChanged", isPaused: state.isPaused }).catch(() => {});
      sendResponse({ status: "paused" });
    } else if (request.action === "updateSettingsUI") {
      const changes = request.settings;
      Object.assign(state.userSettings, changes);
      if (changes.isPaused !== undefined) {
          state.isPaused = changes.isPaused;
          chrome.runtime.sendMessage({ action: "pauseChanged", isPaused: state.isPaused }).catch(() => {});
      }
      await setTabState(tabId, state);
      chrome.runtime.sendMessage({ action: "refreshUI", settings: state.userSettings }).catch(() => {});
      sendResponse({ status: "updated" });
    }
  })();

  return true;
});
