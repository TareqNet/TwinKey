# Twin Key OTP Manager - Project Memory

## Project Overview
A secure Chrome extension for managing TOTP (Time-based One-Time Password) authentication codes with advanced encryption and user-friendly interface.

**Developer**: Tareq Nassry <tareq@tareq.website>  
**Repository**: https://github.com/TareqNet/TwinKey  
**License**: MIT

## Development Timeline & Solutions

### Phase 1: Initial Setup & Language Conversion
**Problem**: Extension was bilingual (Arabic/English) with inconsistent language support
**Solution**: 
- Converted all Arabic text to English across all files
- Moved `background.js` to `js/` folder for better organization
- Updated manifest.json paths accordingly

### Phase 2: UI/UX Improvements & Account Management
**Problem**: Users wanted better account management and organization
**Solution**:
- Removed full-screen account details modal (replaced with dropdown)
- Added dropdown options menu for each account (edit/delete/copy)
- Implemented comprehensive folder/category system with sidebar navigation
- Added sorting options (custom, name, service, date, last used)

### Phase 3: Drag & Drop Implementation
**Problem**: Users needed to reorder accounts easily
**Issues Encountered**:
- Drag & drop only worked when pressing grip icon, not full card
- Elements disappeared during drag operations
- Drop zones didn't hide after drag ended
- Last card couldn't be dragged upward (insertion logic issues)

**Solutions Applied**:
- Implemented container-based drag & drop with event delegation
- Added visual drop zones with index-based positioning
- Fixed CSS opacity and z-index for dragged elements
- Redesigned drop zone system to handle all positions correctly
- Added visual feedback with borders, shadows, and animations

### Phase 4: Layout & Size Optimization  
**Problem**: Users wanted to see more accounts in the popup
**Solution**:
- Increased popup width from 600px → 750px → 850px
- Reduced account card sizes to fit more accounts
- Optimized layout spacing and typography

### Phase 5: Settings & Data Management
**Problem**: Users needed export/import functionality
**Solution**:
- Added settings modal with gear icon in header
- Implemented export functionality (downloads JSON with timestamp)
- Implemented import functionality (uploads and validates JSON)
- Added storage statistics display (accounts, folders, storage size)
- Fixed modal display issues with custom CSS

### Phase 6: Security & Encryption Implementation
**Problem**: Need to encrypt OTP secrets for security
**Challenges**:
- WebAuthn API not supported in Chrome extensions
- System password verification not possible from browser context
- Need user-friendly authentication without compromising security

**Solution Iterations**:
1. **Initial WebAuthn Attempt**: Failed due to Chrome extension limitations
2. **System Password Approach**: Abandoned due to inability to verify actual system passwords
3. **Final PIN/Password Solution**: Implemented secure verification token system

**Final Security Implementation**:
- **Verification Token System**: 
  - Generates random UUID during setup
  - Encrypts token with user's PIN/password
  - Stores encrypted token + plain token for verification
  - Authentication verified by successful decryption matching
- **Encryption**: AES-256-GCM with PBKDF2 key derivation (100,000 iterations)
- **Storage**: Unified Chrome Extension Storage for maximum security
- **No Password Storage**: Only verification tokens stored, never actual passwords

### Phase 7: Storage Unification & Optimization
**Problem**: Mixed usage of localStorage and Chrome Extension Storage
**Solution**:
- Unified all storage to use `chrome.storage.local` (more secure for extensions)
- Added fallback to `localStorage` for development environments
- Updated all authentication and verification methods accordingly

## Current Architecture

### Security Layer
```
User PIN/Password → PBKDF2 → AES-256-GCM → Encrypted Secrets
                     ↓
              Verification Token System
```

### File Structure
```
otp-ui/
├── manifest.json (v3)
├── popup.html (Main UI)
├── css/popup.css (Styling + Modal CSS)
├── js/
│   ├── bootstrap-minimal.js (Custom Bootstrap components)
│   ├── crypto.js (Encryption & Authentication)
│   ├── storage.js (Data persistence)
│   ├── totp.js (RFC 6238 TOTP implementation)
│   ├── popup.js (Main application logic)
│   ├── i18n.js (Internationalization)
│   └── background.js (Extension background script)
```

### Data Flow
1. **Setup**: User creates PIN → Generate verification token → Encrypt & store
2. **Authentication**: User enters PIN → Decrypt verification token → Verify match
3. **Secret Storage**: All OTP secrets encrypted with user's key
4. **TOTP Generation**: Decrypt secret → Generate TOTP → Display code

## Key Technical Decisions

### 1. Authentication Method
**Final Choice**: PIN/Password with verification token system
**Rationale**: 
- User-friendly (simple PIN like "1234" allowed)
- Secure (no password storage, verification by decryption)
- Compatible with Chrome extension limitations

### 2. Storage Strategy
**Final Choice**: Chrome Extension Storage with localStorage fallback
**Rationale**:
- `chrome.storage.local` isolated from web pages (more secure)
- localStorage fallback for development/testing
- Consistent API across both storage types

### 3. Drag & Drop Implementation
**Final Choice**: Container-based event delegation with visual drop zones
**Rationale**:
- Better performance than individual element listeners
- Visual feedback improves UX
- Index-based positioning handles all edge cases

## Lessons Learned

1. **Chrome Extension Limitations**: WebAuthn API restrictions led to custom auth solution
2. **Event Delegation Benefits**: Container-based listeners more reliable than individual element listeners
3. **Security vs Usability**: Verification token system balances both effectively
4. **Storage Consistency**: Using single storage mechanism prevents data conflicts
5. **Visual Feedback Importance**: Drop zones and animations significantly improve UX

## Future Considerations

1. **Biometric Support**: Investigate alternative biometric APIs for extensions
2. **Cloud Sync**: Encrypted cloud backup functionality
3. **Mobile App**: Companion mobile application
4. **Advanced Features**: QR code scanning, bulk import/export
5. **Performance**: Optimize for large numbers of accounts (1000+)

## Development Tools & Dependencies

- **Chrome Extension Manifest V3**
- **Vanilla JavaScript** (no external frameworks)
- **Web Crypto API** for encryption
- **Bootstrap Icons** for UI icons
- **Custom Bootstrap Components** (lightweight implementation)