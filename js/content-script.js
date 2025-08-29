// Content Script for QR Code Detection in Images
// Runs on all web pages to detect QR codes containing TOTP secrets

// Simple QR Code parser (basic implementation)
class SimpleQRParser {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    // Parse image for QR code data
    async parseImage(imageElement) {
        return new Promise((resolve, reject) => {
            try {
                // Set canvas size to match image
                this.canvas.width = imageElement.naturalWidth || imageElement.width;
                this.canvas.height = imageElement.naturalHeight || imageElement.height;
                
                // Draw image to canvas
                this.ctx.drawImage(imageElement, 0, 0);
                
                // Get image data
                const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                
                // Try to decode QR code using jsQR library if available
                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) {
                        resolve(code.data);
                        return;
                    }
                }
                
                // Fallback: look for TOTP URL patterns in image alt text or nearby text
                const altText = imageElement.alt || '';
                const srcText = imageElement.src || '';
                
                if (this.isTOTPUrl(altText)) {
                    resolve(altText);
                    return;
                }
                
                if (this.isTOTPUrl(srcText)) {
                    resolve(srcText);
                    return;
                }
                
                resolve(null);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Check if string is a TOTP URL
    isTOTPUrl(text) {
        return text && (
            text.startsWith('otpauth://totp/') ||
            text.includes('otpauth://totp/') ||
            text.match(/secret=([A-Z2-7]{16,})/i)
        );
    }

    // Extract TOTP data from URL
    extractTOTPData(url) {
        try {
            if (!url.startsWith('otpauth://totp/')) {
                // Try to extract secret from other formats
                const secretMatch = url.match(/secret=([A-Z2-7]{16,})/i);
                if (secretMatch) {
                    return {
                        secret: secretMatch[1],
                        name: 'Unknown Account',
                        issuer: 'Unknown Service'
                    };
                }
                return null;
            }

            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.substring(1).split(':');
            
            const secret = urlObj.searchParams.get('secret');
            const issuer = urlObj.searchParams.get('issuer') || pathParts[0] || 'Unknown Service';
            const accountName = pathParts[1] || pathParts[0] || 'Unknown Account';

            if (!secret) return null;

            return {
                secret: secret.toUpperCase(),
                name: decodeURIComponent(accountName),
                issuer: decodeURIComponent(issuer),
                algorithm: urlObj.searchParams.get('algorithm') || 'SHA1',
                digits: parseInt(urlObj.searchParams.get('digits')) || 6,
                period: parseInt(urlObj.searchParams.get('period')) || 30
            };
        } catch (error) {
            console.error('Error parsing TOTP URL:', error);
            return null;
        }
    }
}

// Initialize QR parser
const qrParser = new SimpleQRParser();

// Add context menu and click handlers to images
function addImageHandlers() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Skip if already processed
        if (img.dataset.twinKeyProcessed) return;
        
        img.dataset.twinKeyProcessed = 'true';
        
        // Add click handler
        img.addEventListener('click', async (e) => {
            // Only process if Ctrl+Click or Alt+Click to avoid interfering with normal clicks
            if (!e.ctrlKey && !e.altKey) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const qrData = await qrParser.parseImage(img);
                
                if (qrData && qrParser.isTOTPUrl(qrData)) {
                    const totpData = qrParser.extractTOTPData(qrData);
                    
                    if (totpData && totpData.secret) {
                        // Send to extension
                        const response = await chrome.runtime.sendMessage({
                            action: 'addQRAccount',
                            accountData: {
                                name: totpData.name,
                                service: totpData.issuer,
                                email: totpData.name.includes('@') ? totpData.name : `${totpData.name}@${totpData.issuer.toLowerCase()}.com`,
                                secret: totpData.secret,
                                folderId: 'uncategorized'
                            }
                        });
                        
                        if (response && response.success) {
                            showNotification('✅ Account added to Twin Key!', 'success');
                        } else {
                            showNotification('❌ Failed to add account', 'error');
                        }
                    } else {
                        showNotification('⚠️ No valid TOTP secret found in QR code', 'warning');
                    }
                } else {
                    showNotification('ℹ️ No QR code found in this image', 'info');
                }
            } catch (error) {
                console.error('QR parsing error:', error);
                showNotification('❌ Error parsing QR code', 'error');
            }
        });
        
        // Add visual indicator on hover
        img.addEventListener('mouseenter', (e) => {
            if (e.ctrlKey || e.altKey) {
                img.style.outline = '3px solid #007bff';
                img.style.cursor = 'pointer';
                img.title = 'Ctrl+Click or Alt+Click to scan for QR code';
            }
        });
        
        img.addEventListener('mouseleave', () => {
            img.style.outline = '';
            img.style.cursor = '';
        });
    });
}

// Show notification to user
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : type === 'warning' ? '#856404' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
        border-radius: 6px;
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 10000;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addImageHandlers);
} else {
    addImageHandlers();
}

// Re-scan for new images periodically (for dynamic content)
const observer = new MutationObserver((mutations) => {
    let hasNewImages = false;
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'IMG' || node.querySelector('img')) {
                        hasNewImages = true;
                    }
                }
            });
        }
    });
    
    if (hasNewImages) {
        setTimeout(addImageHandlers, 100);
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('Twin Key QR scanner loaded - Ctrl+Click or Alt+Click on images to scan for QR codes');