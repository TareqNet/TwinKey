# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an OTP (One-Time Password) manager available both as a web application and Chrome browser extension. It provides a complete TOTP authentication system with folder organization, search capabilities, and a responsive Arabic interface.

## Development Commands

### Web Application
Since this is a client-side web application, no build tools are required:

```bash
# Serve locally with Python
python -m http.server 8000
# or with Node.js
npx http-server -p 8000

# Open in browser
open http://localhost:8000
```

### Chrome Extension
To test the Chrome extension:

```bash
# Load as unpacked extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select this directory
```

## Architecture Overview

**Dual-Platform Architecture:**
- Pure client-side application (no backend required)
- Data stored in browser's localStorage (web) or chrome.storage (extension)
- Bootstrap 5 RTL for responsive Arabic UI
- Modular JavaScript architecture with separation of concerns

**Core Components:**
1. **TOTPGenerator** (`js/totp.js`): RFC 6238 compliant TOTP implementation with Base32 decoding and SHA-1 HMAC
2. **StorageManager** (`js/storage.js`): Unified storage abstraction supporting both localStorage and chrome.storage APIs
3. **UIController** (`js/ui.js`): DOM manipulation for web application (full interface)
4. **PopupManager** (`js/popup.js`): Compact popup interface for Chrome extension
5. **OTPManager** (`js/app.js`): Main web application controller
6. **Background Script** (`background.js`): Chrome extension service worker

**Key Features:**
- Add/edit/delete OTP accounts with service categorization
- Folder-based organization system  
- Real-time search and filtering
- Auto-refreshing OTP codes with visual countdown timers
- One-click copy functionality
- Responsive design for mobile and desktop
- Chrome extension popup interface (400x600px)
- Context menu integration
- Extension badge showing account count

## Key Directories and Files

```
otp-ui/
├── index.html              # Main web application (Arabic RTL)
├── popup.html              # Chrome extension popup interface
├── manifest.json           # Chrome extension manifest
├── background.js           # Extension service worker
├── css/
│   ├── styles.css         # Main application styles
│   └── popup.css          # Extension popup styles
├── js/
│   ├── totp.js           # TOTP algorithm implementation
│   ├── storage.js        # Unified storage (localStorage + chrome.storage)
│   ├── ui.js             # Web application UI controller
│   ├── popup.js          # Extension popup controller
│   └── app.js            # Main web application entry point
├── icons/
│   ├── icon16.png        # Extension toolbar icon
│   ├── icon48.png        # Extension management icon
│   └── icon128.png       # Chrome Web Store icon
└── docs/
    ├── FEATURE_TEMPLATE.md # Documentation template
    └── history/            # Historical documentation
```

## Development Workflow

**Adding New Features:**
1. Update `StorageManager` for new data structures (handles both localStorage and chrome.storage)
2. Implement business logic in appropriate class
3. Add UI components in `UIController` (web) and/or `PopupManager` (extension)
4. Update forms and event handlers as needed
5. Test in both web and extension environments

**Testing:**

*Web Application:*
- Use dev console: `devTools.generateTestAccounts(5)`
- Sample Base32 secret: `JBSWY3DPEHPK3PXP`
- Clear test data: `devTools.clearTestData()`

*Chrome Extension:*
- Load unpacked extension in chrome://extensions/
- Test popup functionality
- Verify chrome.storage persistence
- Check background script console for errors

## Important Implementation Details

**TOTP Algorithm:**
- Implements RFC 6238 standard with 30-second time step
- Custom Base32 decoder and SHA-1 HMAC implementation
- No external cryptography dependencies

**Data Storage:**
- Web app: localStorage
- Extension: chrome.storage.local (synced across browser sessions)
- Unified StorageManager API handles both storage types automatically
- Export/import functionality for data portability  
- Automatic cleanup and validation

**Security Notes:**
- Secrets stored locally only (localStorage/chrome.storage)
- No data transmission to external servers
- Base32 secret validation on input
- Chrome extension permissions: "storage" and "activeTab" only

**UI Patterns:**
- Bootstrap modals for forms (web app)
- Compact popup forms (extension)
- Toast notifications for user feedback
- Real-time OTP updates with visual progress indicators
- Responsive Arabic RTL layout
- Extension-specific: 400px width popup constraint

## Development Tools

Available in browser console when running locally:
- `window.app`: Main application instance
- `window.devTools`: Development utilities
- `devTools.generateTestAccounts(n)`: Create test data
- `devTools.showStats()`: Display app statistics