# Twin Key OTP Manager - Project Documentation Index

## Project Overview
A secure Chrome extension for managing TOTP (Time-based One-Time Password) authentication codes with advanced encryption and user-friendly interface.

**Developer**: Tareq Nassry <tareq@tareq.website>  
**Repository**: https://github.com/TareqNet/TwinKey  
**License**: MIT

## Documentation Structure

### Core Documentation
- **CLAUDE.md** - Quick reference for development guidance (points to this file)
- **PROJECT_MEMORY.md** - This file (complete project documentation and architecture)

### Historical Development Timeline

**Detailed chronological documentation available in:** `docs/history/`

**Development Phases Summary:**
- **Phase 0** (2024-08-26): Project foundation and initial setup
- **Phase 1** (2024-08-01): Language conversion and file reorganization  
- **Phase 2** (2024-08-05): UI/UX improvements and folder system
- **Phase 3** (2024-08-10): Drag & drop implementation
- **Phase 4** (2024-08-15): Layout optimization (600px → 850px)
- **Phase 5** (2024-08-18): Settings modal and data management
- **Phase 6** (2024-08-20): Security implementation and encryption
- **Phase 7** (2024-08-25): Storage system unification

Each phase is documented in detail with technical decisions, implementation steps, challenges faced, and lessons learned.

### Developer Resources
- **[docs/history/template.md](docs/history/template.md)** - Template for historical change documentation

## Current Architecture Overview

### Security Layer
```
User PIN/Password → PBKDF2 (100k iterations) → AES-256-GCM → Encrypted Secrets
                     ↓
              Verification Token System
```

### Core Components
1. **CryptoManager** (`js/crypto.js`) - Encryption & authentication system
2. **StorageManager** (`js/storage.js`) - Chrome storage with encryption integration  
3. **PopupManager** (`js/popup.js`) - Main application controller & authentication
4. **TOTPGenerator** (`js/totp.js`) - RFC 6238 compliant TOTP implementation

### File Structure
```
otp-ui/
├── manifest.json           # Chrome Extension Manifest V3
├── popup.html             # Main popup interface (850px width)
├── css/popup.css          # Extension-optimized styling
├── js/
│   ├── crypto.js          # Encryption & authentication system
│   ├── storage.js         # Chrome storage with encryption
│   ├── popup.js           # Main popup controller
│   ├── totp.js            # RFC 6238 TOTP implementation
│   ├── bootstrap-minimal.js # Custom Bootstrap components
│   ├── i18n.js            # Internationalization framework
│   └── background.js      # Extension background script
├── docs/
│   └── history/           # Historical development documentation
│       ├── template.md    # Template for new change documentation
│       └── [YYYY-MM-DD]_phase[N]_[name].md # Individual phase docs
├── PROJECT_MEMORY.md      # Complete project documentation
└── CLAUDE.md             # Development guidance reference
```

## Key Technical Decisions

### Authentication Architecture
- **Method**: PIN/Password with verification token system
- **Rationale**: Balances security with usability within Chrome extension limitations
- **Security**: AES-256-GCM encryption, PBKDF2 key derivation, no password storage

### Storage Strategy  
- **Primary**: chrome.storage.local (secure, extension-isolated)
- **Fallback**: localStorage (development environments only)
- **Rationale**: Maximum security with development flexibility

### UI/UX Patterns
- **Drag & Drop**: Container-based event delegation with visual feedback
- **Layout**: 850px popup width for optimal visibility
- **Organization**: Folder system with sidebar navigation

## Development Workflow

### Adding New Features
1. Read relevant historical documentation for context
2. Use `docs/history/template.md` for documenting the change
3. Follow established patterns in core components
4. Test authentication flow and data persistence
5. Document the change chronologically in `docs/history/`

### Documentation Standards
- **Historical Changes**: Use template in `docs/history/template.md`
- **Features**: Update feature sections in this file with new capabilities  
- **Architecture**: Update this file for structural changes
- **User Guides**: Update installation/usage sections in this file as needed

## Future Considerations

1. **Biometric Support**: Investigate alternative APIs for Chrome extensions
2. **Cloud Sync**: Encrypted cloud backup functionality  
3. **Mobile App**: Companion mobile application
4. **Advanced Features**: QR code scanning, bulk operations
5. **Performance**: Optimize for 1000+ accounts

---

# Key Features Overview

## Core Capabilities
- **🔐 Security**: AES-256-GCM encryption, PIN/password authentication, local-only storage
- **🎨 Interface**: 850px popup, Bootstrap components, drag & drop reordering
- **📁 Organization**: Folders, search, multiple sorting options
- **⚙️ Management**: Add/edit/delete accounts, import/export, settings modal
- **🌐 Internationalization**: English/Arabic support with RTL layout
- **🔄 TOTP**: RFC 6238 compliant, 30-second refresh, one-click copy

---

# Installation & Usage

## Quick Setup
1. Clone: `git clone https://github.com/TareqNet/TwinKey`
2. Open Chrome → `chrome://extensions/` → Enable Developer mode
3. Click "Load unpacked" → Select `otp-ui` directory
4. Pin extension to toolbar for easy access

## First Use
1. Set up PIN/password (all secrets will be encrypted)
2. Click "+" to add account (name, service, email, secret key)
3. Copy OTP codes with one click, organize with folders

---

# Internationalization

## Languages
- **English** (en) - Default
- **Arabic** (ar) - RTL support

## Implementation
- Files: `locales/en.json`, `locales/ar.json`
- HTML: `data-i18n="key"` attributes
- JavaScript: `window.i18n.t('key')`  
- RTL: Automatic Bootstrap CSS switching

---

# Development Template

Use `docs/history/template.md` for new feature documentation.

---
**Last Updated**: 2024-09-03  
**Status**: Active Development