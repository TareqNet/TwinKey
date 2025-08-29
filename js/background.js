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
                name: 'Uncategorized',
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
        
        chrome.contextMenus.create({
            id: 'scanQRCode',
            title: 'Scan QR Code for 2FA',
            contexts: ['image']
        });
    } catch (error) {
        console.log('Context menu creation failed:', error);
    }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'openTwinKey') {
        // Open popup instead of full page
        chrome.action.openPopup();
    } else if (info.menuItemId === 'scanQRCode') {
        // Inject script to scan the clicked image
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scanImageForQR,
            args: [info.srcUrl]
        });
    }
});

// Function to inject into page for QR scanning
function scanImageForQR(imageUrl) {
    // Create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async function() {
        try {
            // Create canvas and draw image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Simple pattern matching for TOTP URLs
            // In a real implementation, you'd use a proper QR decoder library
            const patterns = [
                /otpauth:\/\/totp\/[^?]*\?secret=([A-Z2-7]{16,})/i,
                /secret[=:]([A-Z2-7]{16,})/i
            ];
            
            let foundSecret = null;
            let accountData = null;
            
            // Try to find patterns in the image URL or alt text
            const testString = imageUrl + ' ' + (img.alt || '');
            
            for (const pattern of patterns) {
                const match = testString.match(pattern);
                if (match) {
                    if (testString.includes('otpauth://totp/')) {
                        try {
                            const url = new URL(testString.match(/otpauth:\/\/totp\/[^\s]*/)[0]);
                            const pathParts = url.pathname.substring(1).split(':');
                            
                            accountData = {
                                name: decodeURIComponent(pathParts[1] || pathParts[0] || 'Unknown Account'),
                                service: decodeURIComponent(url.searchParams.get('issuer') || pathParts[0] || 'Unknown Service'),
                                email: pathParts[1] || 'unknown@example.com',
                                secret: url.searchParams.get('secret').toUpperCase(),
                                folderId: 'uncategorized'
                            };
                            foundSecret = true;
                        } catch (e) {
                            console.error('Error parsing TOTP URL:', e);
                        }
                    } else {
                        accountData = {
                            name: 'QR Account',
                            service: 'Unknown Service',
                            email: 'qr@example.com',
                            secret: match[1].toUpperCase(),
                            folderId: 'uncategorized'
                        };
                        foundSecret = true;
                    }
                    break;
                }
            }
            
            if (foundSecret && accountData) {
                // Send to background script
                const response = await chrome.runtime.sendMessage({
                    action: 'addQRAccount',
                    accountData: accountData
                });
                
                if (response && response.success) {
                    console.log('Account added successfully from QR code');
                } else {
                    console.error('Failed to add account from QR code');
                }
            } else {
                console.log('No TOTP data found in image');
                alert('No 2FA QR code found in this image.');
            }
            
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error scanning QR code from image.');
        }
    };
    
    img.onerror = function() {
        console.error('Could not load image for QR scanning');
        alert('Could not load image for scanning.');
    };
    
    img.src = imageUrl;
}

// Action button click handler
chrome.action.onClicked.addListener((tab) => {
    // This will automatically open the popup due to manifest configuration
    // But we can add additional logic here if needed
    console.log('TwinKey popup opened');
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
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
            // Open popup instead of full page
            chrome.action.openPopup();
            break;
            
        case 'addQRAccount':
            // Add account from QR code scan
            const qrAccount = {
                ...request.accountData,
                id: generateId(),
                createdAt: new Date().toISOString(),
                lastUsed: null
            };
            
            const success = await saveAccountToStorage(qrAccount);
            sendResponse({ success });
            
            if (success) {
                // Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'Twin Key',
                    message: `Added ${qrAccount.name} from QR code!`
                });
            }
            return true;
            
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

// Utility function to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}