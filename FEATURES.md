# Twin Key OTP Manager - Features Documentation

## 🔐 Security Features

### Advanced Encryption
- **AES-256-GCM Encryption**: Military-grade encryption for all OTP secrets
- **PBKDF2 Key Derivation**: 100,000 iterations with random salt
- **No Password Storage**: Uses verification token system for authentication
- **Chrome Extension Storage**: Isolated storage not accessible by web pages

### Authentication System
- **PIN/Password Protection**: Simple PIN (e.g., "1234") or complex password support
- **Verification Token**: Random UUID encrypted with user password for verification
- **Secure Unlock**: Authentication required every time extension is opened
- **Wrong Password Protection**: Invalid attempts clear input and refocus

### Data Protection
- **Local-Only Storage**: No data sent to external servers
- **Encrypted State Display**: Shows 🔒LOCKED for encrypted accounts when not authenticated
- **Automatic Session Management**: Requires re-authentication on each popup open

## 🎨 User Interface

### Modern Design
- **850px Wide Popup**: Optimized width for better visibility
- **Bootstrap 5 Components**: Modern, responsive design elements
- **Custom CSS**: Tailored styling for Chrome extension environment
- **Icon Integration**: Bootstrap Icons throughout the interface

### Account Management
- **Account Cards**: Compact, information-rich account display
- **Real-time TOTP Codes**: Auto-refreshing 6-digit codes with countdown timer
- **One-Click Copy**: Copy TOTP codes to clipboard with visual feedback
- **Service Icons**: Visual identification for different services

### Folder Organization
- **Sidebar Navigation**: Dedicated folder sidebar with collapsible sections
- **Default Folders**: Automatic "Uncategorized" folder creation
- **Folder Management**: Add, rename, delete folders with account reassignment
- **Visual Organization**: Clear folder structure with account counts

## 🔄 Account Management

### CRUD Operations
- **Add Accounts**: Simple form with service selection and secret key input
- **Edit Accounts**: Update name, service, email, and folder assignment
- **Delete Accounts**: Safe deletion with confirmation
- **Bulk Operations**: Import/export multiple accounts

### Account Details
- **Service Information**: Account name, service type, email
- **Usage Tracking**: Last used timestamp tracking
- **Folder Assignment**: Organize accounts into custom folders
- **Sort Order**: Custom drag-and-drop ordering maintained

### Import/Export System
- **JSON Export**: Complete data backup with timestamp
- **JSON Import**: Restore accounts, folders, and settings
- **Data Validation**: Import validation with error handling
- **Encryption During Import**: Automatic encryption of imported secrets

## 🎯 Sorting & Organization

### Multiple Sort Options
- **Custom Order**: User-defined drag-and-drop ordering (default)
- **Alphabetical**: Sort by account name
- **Service-based**: Group by service provider
- **Date Added**: Sort by creation timestamp
- **Last Used**: Sort by most recently used

### Drag & Drop Interface
- **Visual Drag Handle**: Grip icon for intuitive dragging
- **Drop Zones**: Visual indicators showing valid drop positions
- **Real-time Preview**: Live feedback during drag operations
- **Smooth Animations**: CSS transitions for polished experience

### Search & Filter
- **Real-time Search**: Instant filtering as you type
- **Multi-field Search**: Search across account names, services, and emails
- **Folder Filtering**: View accounts by specific folder
- **Combined Filtering**: Search within selected folders

## 🔧 Settings & Configuration

### Data Management
- **Export All Data**: Download complete backup as JSON file
- **Import Data**: Restore from backup files
- **Clear Data**: Reset all application data
- **Storage Statistics**: View accounts count, folders count, and storage usage

### Application Settings
- **Auto-refresh**: Configurable TOTP code refresh intervals
- **Theme Support**: Light/dark theme options
- **Language Support**: Internationalization framework ready
- **Backup Timestamps**: Automatic timestamps on exports

## 🚀 Technical Features

### TOTP Implementation
- **RFC 6238 Compliant**: Standard TOTP algorithm implementation
- **Custom Base32 Decoder**: No external dependencies
- **SHA-1 HMAC**: Cryptographically secure hash function
- **30-second Time Steps**: Industry standard timing

### Performance Optimizations
- **Event Delegation**: Efficient event handling for dynamic content
- **Lazy Loading**: Optimized rendering for large account lists
- **Memory Management**: Proper cleanup of DOM elements
- **Async Operations**: Non-blocking UI operations

### Development Features
- **Modular Architecture**: Separated concerns across multiple files
- **Error Handling**: Comprehensive error catching and user feedback
- **Debug Logging**: Console logging for development
- **Fallback Support**: localStorage fallback for development environments

## 🎮 User Experience

### Intuitive Navigation
- **Toast Notifications**: Non-intrusive success/error messages
- **Loading States**: Clear feedback during operations
- **Keyboard Shortcuts**: Enter key support for forms
- **Focus Management**: Proper tab order and focus handling

### Visual Feedback
- **Copy Success Animation**: Visual confirmation of clipboard operations
- **Drag Preview**: Real-time drag feedback with styling
- **Form Validation**: Immediate input validation with helpful messages
- **Progress Indicators**: Visual countdown timers for TOTP codes

### Accessibility
- **Screen Reader Support**: ARIA labels and semantic HTML
- **High Contrast**: Clear visual distinctions
- **Keyboard Navigation**: Full keyboard accessibility
- **Error Messages**: Clear, actionable error descriptions

## 📱 Cross-Platform Support

### Chrome Extension
- **Manifest V3**: Latest Chrome extension standard
- **Popup Interface**: Optimized for extension popup constraints
- **Background Script**: Minimal background processing
- **Permissions**: Minimal required permissions for security

### Browser Compatibility
- **Chrome**: Primary platform with full feature support
- **Chromium-based**: Edge, Brave, Opera compatibility
- **Development Mode**: Works in local development environment
- **Web Crypto API**: Modern browser cryptography support

## 🔮 Future-Ready Architecture

### Extensibility
- **Plugin System**: Modular component architecture ready for extensions
- **API Abstraction**: Storage and crypto APIs abstracted for portability
- **Theme System**: CSS custom properties for easy theming
- **Internationalization**: i18n framework for multi-language support

### Scalability
- **Performance**: Optimized for thousands of accounts
- **Memory Usage**: Efficient DOM manipulation and cleanup
- **Storage**: Scalable data structures for growth
- **Maintenance**: Clean, documented codebase for future development

## 📊 Analytics & Monitoring

### Usage Statistics
- **Account Counts**: Track number of managed accounts
- **Storage Usage**: Monitor local storage consumption
- **Last Usage**: Track when accounts were last accessed
- **Export History**: Backup creation timestamps

### Error Tracking
- **Console Logging**: Development error tracking
- **User Feedback**: Toast notifications for all operations
- **Validation Errors**: Clear form validation messages
- **Recovery Options**: Graceful degradation and error recovery