# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based OTP (One-Time Password) manager application built with vanilla HTML, CSS, and JavaScript. It provides a complete TOTP authentication system with folder organization, search capabilities, and a responsive Arabic interface.

## Development Commands

Since this is a client-side web application, no build tools are required:

```bash
# Serve locally with Python
python -m http.server 8000
# or with Node.js
npx http-server -p 8000

# Open in browser
open http://localhost:8000
```

## Architecture Overview

**Frontend-Only Architecture:**
- Pure client-side application (no backend required)
- Data stored in browser's localStorage
- Bootstrap 5 RTL for responsive Arabic UI
- Modular JavaScript architecture with separation of concerns

**Core Components:**
1. **TOTPGenerator** (`js/totp.js`): RFC 6238 compliant TOTP implementation with Base32 decoding and SHA-1 HMAC
2. **StorageManager** (`js/storage.js`): LocalStorage abstraction for accounts, folders, and settings management
3. **UIController** (`js/ui.js`): DOM manipulation, event handling, and user interface logic
4. **OTPManager** (`js/app.js`): Main application controller and initialization

**Key Features:**
- Add/edit/delete OTP accounts with service categorization
- Folder-based organization system  
- Real-time search and filtering
- Auto-refreshing OTP codes with visual countdown timers
- One-click copy functionality
- Responsive design for mobile and desktop

## Key Directories and Files

```
otp-ui/
├── index.html              # Main application page (Arabic RTL)
├── css/styles.css          # Custom Bootstrap theme and animations
├── js/
│   ├── totp.js            # TOTP algorithm implementation
│   ├── storage.js         # localStorage data management
│   ├── ui.js              # UI controller and event handling
│   └── app.js             # Main application entry point
└── PROJECT_DOCUMENTATION.md # Detailed technical documentation
```

## Development Workflow

**Adding New Features:**
1. Update `StorageManager` for new data structures
2. Implement business logic in appropriate class
3. Add UI components in `UIController`
4. Update forms and event handlers as needed

**Testing Accounts:**
- Use dev console: `devTools.generateTestAccounts(5)`
- Sample Base32 secret: `JBSWY3DPEHPK3PXP`
- Clear test data: `devTools.clearTestData()`

## Important Implementation Details

**TOTP Algorithm:**
- Implements RFC 6238 standard with 30-second time step
- Custom Base32 decoder and SHA-1 HMAC implementation
- No external cryptography dependencies

**Data Storage:**
- All data stored client-side in localStorage
- Export/import functionality for data portability  
- Automatic cleanup and validation

**Security Notes:**
- Secrets stored in browser localStorage (client-side only)
- No data transmission to external servers
- Base32 secret validation on input

**UI Patterns:**
- Bootstrap modals for forms
- Toast notifications for user feedback
- Real-time OTP updates with visual progress indicators
- Responsive Arabic RTL layout

## Development Tools

Available in browser console when running locally:
- `window.app`: Main application instance
- `window.devTools`: Development utilities
- `devTools.generateTestAccounts(n)`: Create test data
- `devTools.showStats()`: Display app statistics