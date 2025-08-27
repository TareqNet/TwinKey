// Background Service Worker for TwinKey Chrome Extension

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('TwinKey extension installed');
        
        // Set default settings on first install
        chrome.storage.local.set({
            otp_settings: {
                theme: 'light',
                autoRefresh: true,
                refreshInterval: 30,
                showEmails: true,
                sortBy: 'name',
                lastBackup: null
            }
        });
        
        // Initialize default folder
        chrome.storage.local.set({
            otp_folders: [{
                id: 'uncategorized',
                name: 'غير مصنف',
                parentId: null,
                createdAt: new Date().toISOString()
            }]
        });
        
        // Initialize empty accounts array
        chrome.storage.local.set({
            otp_accounts: []
        });
        
        // Open welcome page
        // Open popup instead of full page
        chrome.action.openPopup();
    }
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
    try {
        chrome.contextMenus.create({
            id: 'openTwinKey',
            title: 'Open Twin Key',
            contexts: ['page']
        });
    } catch (error) {
        console.log('Context menu creation failed:', error);
    }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openTwinKey') {
        // Open popup instead of full page
        chrome.action.openPopup();
    }
});

// Action button click handler
chrome.action.onClicked.addListener((tab) => {
    // This will automatically open the popup due to manifest configuration
    // But we can add additional logic here if needed
    console.log('TwinKey popup opened');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'getAccounts':
            chrome.storage.local.get('otp_accounts', (result) => {
                sendResponse(result.otp_accounts || []);
            });
            return true; // Keep channel open for async response
            
        case 'saveAccount':
            saveAccountToStorage(request.account).then(success => {
                sendResponse({ success });
            });
            return true;
            
        case 'updateBadge':
            // Badge removed - do nothing
            break;
            
        case 'openFullApp':
            chrome.tabs.create({
                url: chrome.runtime.getURL('index.html')
            });
            break;
            
        default:
            console.log('Unknown message action:', request.action);
    }
});

// Storage change listener
chrome.storage.onChanged.addListener((changes, namespace) => {
    // Badge removed - no longer needed
});

// Utility functions
async function getMostRecentAccount() {
    try {
        const result = await chrome.storage.local.get('otp_accounts');
        const accounts = result.otp_accounts || [];
        
        if (accounts.length === 0) return null;
        
        // Find most recently used account
        const sortedAccounts = accounts.sort((a, b) => {
            const aTime = new Date(a.lastUsed || a.createdAt);
            const bTime = new Date(b.lastUsed || b.createdAt);
            return bTime - aTime;
        });
        
        return sortedAccounts[0];
    } catch (error) {
        console.error('Error getting most recent account:', error);
        return null;
    }
}


async function saveAccountToStorage(account) {
    try {
        const result = await chrome.storage.local.get('otp_accounts');
        const accounts = result.otp_accounts || [];
        
        // Add or update account
        const existingIndex = accounts.findIndex(acc => acc.id === account.id);
        if (existingIndex >= 0) {
            accounts[existingIndex] = account;
        } else {
            accounts.push(account);
        }
        
        await chrome.storage.local.set({ otp_accounts: accounts });
        return true;
    } catch (error) {
        console.error('Error saving account:', error);
        return false;
    }
}

function updateBadgeCount(count) {
    // Remove badge text completely
    chrome.action.setBadgeText({ text: '' });
}


// Badge functionality removed - no initialization needed