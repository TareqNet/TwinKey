// Background Service Worker for OTP Manager Chrome Extension

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('OTP Manager extension installed');
        
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
        chrome.tabs.create({
            url: chrome.runtime.getURL('index.html')
        });
    }
});

// Context menu setup (optional - for right-click functionality)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openOTPManager',
        title: 'فتح مدير OTP',
        contexts: ['all']
    });
    
    chrome.contextMenus.create({
        id: 'copyCurrentOTP',
        title: 'نسخ كود OTP الحالي',
        contexts: ['all']
    });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openOTPManager') {
        chrome.action.openPopup();
    } else if (info.menuItemId === 'copyCurrentOTP') {
        // Get the most recently used account and copy its OTP
        getMostRecentAccount().then(account => {
            if (account) {
                copyAccountOTP(account);
            }
        });
    }
});

// Action button click handler
chrome.action.onClicked.addListener((tab) => {
    // This will automatically open the popup due to manifest configuration
    // But we can add additional logic here if needed
    console.log('OTP Manager popup opened');
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
            updateBadgeCount(request.count);
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
    if (namespace === 'local') {
        // Update badge when accounts change
        if (changes.otp_accounts) {
            const accountCount = changes.otp_accounts.newValue ? changes.otp_accounts.newValue.length : 0;
            updateBadgeCount(accountCount);
        }
    }
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

async function copyAccountOTP(account) {
    try {
        // Note: This would require implementing TOTP generation in background
        // For now, we'll just show a notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'OTP Manager',
            message: `لنسخ كود ${account.name}، افتح النافذة المنبثقة`
        });
    } catch (error) {
        console.error('Error copying OTP:', error);
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
    const badgeText = count > 0 ? count.toString() : '';
    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#007bff' });
}

// Initialize badge count on startup
chrome.storage.local.get('otp_accounts', (result) => {
    const accounts = result.otp_accounts || [];
    updateBadgeCount(accounts.length);
});

// Alarm for periodic cleanup or notifications (if needed in future)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'otpCleanup') {
        // Perform any periodic maintenance
        console.log('Performing periodic cleanup');
    }
});

// Set up periodic alarm (optional)
chrome.alarms.create('otpCleanup', {
    delayInMinutes: 60,
    periodInMinutes: 60
});