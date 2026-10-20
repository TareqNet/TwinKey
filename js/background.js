// Background Service Worker for TwinKey Chrome Extension
// Default folders/settings are created by StorageManager.initializeDefaults() when the popup opens.

chrome.runtime.onInstalled.addListener((details) => {
    chrome.contextMenus.create({
        id: "openTwinKey",
        title: "Open Twin Key",
        contexts: ["page"]
    }, () => void chrome.runtime.lastError);

    if (details.reason === "install") {
        // Show the setup screen right away; may fail without a focused window
        chrome.action.openPopup().catch(() => {});
    }
});

chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === "openTwinKey") {
        chrome.action.openPopup().catch(() => {});
    }
});
