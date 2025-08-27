# Chrome Extension Installation Guide

This guide explains how to install and use the OTP Manager Chrome extension.

## Installation Steps

### Option 1: Development Installation (Current)

1. **Download/Clone the Project**
   ```bash
   git clone [repository-url]
   cd otp-ui
   ```

2. **Open Chrome Extensions Page**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `otp-ui` directory
   - The extension should now appear in your extensions list

5. **Pin the Extension** (Optional)
   - Click the Extensions icon (puzzle piece) in Chrome toolbar
   - Pin "OTP Manager" for easy access

### Option 2: Chrome Web Store (Future)
*This extension is not yet published to the Chrome Web Store.*

## Using the Extension

### Accessing the Extension

1. **Popup Interface**
   - Click the OTP Manager icon in the Chrome toolbar
   - 400x600px compact interface opens

2. **Full Interface**
   - Click the settings gear in the popup
   - Or right-click the extension icon → "Options"
   - Opens the full web interface in a new tab

### Adding Your First Account

1. Click the "+" button in the popup
2. Fill in the required information:
   - **Account Name**: e.g., "My Google Account"
   - **Service**: Select from dropdown or choose "Other"
   - **Email**: Your account email
   - **Secret Key**: 32-character Base32 key from the service

3. Click "Add Account"

### Managing Accounts

- **View OTP Codes**: Codes auto-refresh every 30 seconds
- **Copy Codes**: Click the copy button or the account card
- **Search**: Use the search bar to find specific accounts
- **Account Details**: Click an account to view details

### Context Menu (Right-Click)

- Right-click on any webpage
- Select "Open OTP Manager" to open popup
- Select "Copy Current OTP" to copy most recently used code

## Features

### Popup Interface
- Compact 400px wide design
- Real-time OTP code generation
- Quick search and copy functionality
- Account management forms

### Background Features
- Badge showing number of accounts
- Context menu integration
- Data persistence across browser sessions
- Auto-initialization on first install

### Security
- All data stored locally in Chrome's secure storage
- No network requests or external data transmission
- Chrome extension sandbox security

## Data Storage

- Uses `chrome.storage.local` for data persistence
- Data syncs across Chrome sessions on the same device
- Compatible with Chrome's built-in backup/restore
- Export/import functionality available in full interface

## Troubleshooting

### Extension Not Loading
1. Check that all required files are present
2. Verify manifest.json syntax
3. Check Chrome DevTools for console errors
4. Try disabling and re-enabling the extension

### Icons Not Showing
- Icons are optional but recommended
- Add PNG files to the `icons/` directory:
  - `icon16.png` (16x16px)
  - `icon48.png` (48x48px) 
  - `icon128.png` (128x128px)

### Data Not Saving
1. Check Chrome extension permissions
2. Verify "storage" permission in manifest.json
3. Test with a simple account first
4. Check background script console for errors

### Popup Not Opening
1. Ensure popup.html exists and is valid
2. Check popup.js for JavaScript errors
3. Verify manifest.json popup configuration
4. Try reloading the extension

## Development

### Testing Changes
1. Make code changes
2. Go to chrome://extensions/
3. Click the refresh icon on the OTP Manager extension
4. Test the changes

### Debugging
- **Popup**: Right-click popup → "Inspect"
- **Background**: Extensions page → "Service worker" → "Inspect"
- **Full app**: Standard browser DevTools

## Security Considerations

### Permissions
- `storage`: For local data persistence
- `activeTab`: For context menu functionality

### Data Protection
- All secrets stored locally only
- No external network requests
- Chrome extension security sandbox
- Regular security updates recommended

## Support

For issues, feature requests, or contributions:
- Check the project documentation
- Open an issue in the project repository
- Review the Chrome extension development guidelines