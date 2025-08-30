# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a secure Chrome Extension OTP (One-Time Password) manager built with vanilla HTML, CSS, and JavaScript. It provides a complete TOTP authentication system with advanced encryption, folder organization, drag-and-drop reordering, and comprehensive security features.

**Developer**: Tareq Nassry <tareq@tareq.website>  
**Repository**: https://github.com/TareqNet/TwinKey  
**License**: MIT

## Development Commands

Since this is a Chrome extension, no build tools are required:

```bash
# Load extension in Chrome
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the otp-ui directory

# For local development/testing
python -m http.server 8000
# or with Node.js
npx http-server -p 8000
```

## Architecture Overview

**Chrome Extension Architecture (Manifest V3):**
- Client-side extension with popup interface
- Data stored in Chrome Extension Storage (chrome.storage.local)
- Advanced AES-256-GCM encryption for all secrets
- Modular JavaScript architecture with separation of concerns

**Core Components:**
1. **CryptoManager** (`js/crypto.js`): AES-256-GCM encryption, PBKDF2 key derivation, verification token system
2. **StorageManager** (`js/storage.js`): Chrome storage abstraction with encryption integration
3. **PopupManager** (`js/popup.js`): Main application controller, authentication flow, UI management
4. **TOTPGenerator** (`js/totp.js`): RFC 6238 compliant TOTP implementation with Base32 decoding

**Security Features:**
- PIN/Password authentication with verification token system
- All OTP secrets encrypted with user's key
- No password storage (only encrypted verification tokens)
- Chrome Extension Storage isolation (not accessible by web pages)

## Key Directories and Files

```
otp-ui/
├── manifest.json           # Chrome Extension Manifest V3
├── popup.html             # Main popup interface (850px width)
├── css/popup.css          # Extension-optimized styling with modal CSS
├── js/
│   ├── crypto.js          # Encryption & authentication system
│   ├── storage.js         # Chrome storage with encryption integration
│   ├── popup.js           # Main popup controller & authentication
│   ├── totp.js            # RFC 6238 TOTP implementation
│   ├── bootstrap-minimal.js # Custom Bootstrap components
│   ├── i18n.js            # Internationalization framework
│   └── background.js      # Extension background script
├── PROJECT_MEMORY.md      # Development timeline and solutions
├── FEATURES.md           # Complete feature documentation
└── CLAUDE.md             # This development guide
```

## Development Workflow

**Adding New Features:**
1. Update `CryptoManager` if encryption changes needed
2. Update `StorageManager` for new data structures
3. Implement UI logic in `PopupManager`
4. Update popup.html for new UI elements
5. Test authentication flow and data persistence

**Testing Workflow:**
1. Load extension in Chrome
2. Test authentication setup and verification
3. Add test accounts with various services
4. Test drag-and-drop, folders, export/import
5. Verify encryption by checking chrome.storage.local content

## Important Implementation Details

**Security Architecture:**
- **Verification Token System**: Random UUID encrypted with user PIN for authentication verification
- **AES-256-GCM**: All secrets encrypted with user-derived key
- **PBKDF2**: 100,000 iterations for key derivation
- **No Password Storage**: Only verification tokens stored, never actual passwords

**Authentication Flow:**
1. **Setup**: User creates PIN → Generate random token → Encrypt token → Store encrypted + plain tokens
2. **Login**: User enters PIN → Recreate key → Decrypt token → Verify match → Grant access
3. **Wrong Password**: Decryption fails → Access denied → Clear input

**Data Storage:**
- Primary: `chrome.storage.local` (secure, extension-isolated)
- Fallback: `localStorage` (development environments)
- All secrets encrypted before storage
- Verification tokens for authentication

**Drag & Drop System:**
- Container-based event delegation
- Visual drop zones with index-based positioning
- Smooth animations and visual feedback
- Handles all edge cases (first, last, middle positions)

## Chrome Extension Specific Notes

**Manifest V3 Compliance:**
- Uses chrome.storage.local for secure data persistence
- Minimal background script for service worker
- Popup-based interface optimized for extension constraints
- No external network requests (fully offline)

**Security Limitations:**
- WebAuthn API not available in extension context
- System password verification not possible
- Solution: Custom PIN/password with verification token system

**Storage Strategy:**
- `chrome.storage.local` preferred over `localStorage`
- Extension storage isolated from web page access
- Automatic fallback handling for development

## UI Patterns & Components

**Custom Bootstrap Implementation:**
- Minimal Bootstrap components (Modal, Toast, Dropdown)
- Extension-optimized CSS without full Bootstrap
- Custom modal system with backdrop and escape handling

**Visual Feedback:**
- Toast notifications for all operations
- Drag preview with visual styling
- Real-time TOTP countdown timers
- Copy success animations

**Responsive Design:**
- 850px popup width for optimal visibility
- Compact account cards for maximum density
- Sidebar folder navigation
- Mobile-friendly touch targets

## Development Best Practices

**Security:**
- Never store passwords in plain text
- Always encrypt secrets before storage
- Use verification tokens for authentication
- Clear sensitive data from memory after use

**Performance:**
- Use event delegation for dynamic content
- Minimize DOM manipulation
- Async/await for all storage operations
- Proper error handling with user feedback

**Maintenance:**
- Comprehensive error logging
- Clear separation of concerns
- Documented public methods
- Future-ready architecture for extensibility

## Troubleshooting

**Common Issues:**
1. **Authentication fails**: Check verification token encryption/decryption
2. **Drag-drop not working**: Verify event delegation setup
3. **Storage errors**: Confirm chrome.storage permissions in manifest
4. **Modal not showing**: Check CSS modal styles and Bootstrap components

**Debug Tools:**
- Chrome DevTools for extension debugging
- Console logging for crypto operations
- Storage inspection in chrome://extensions
- Network tab should show no external requests