# OTP Manager - Project Documentation

## Project Overview
A simple web-based OTP (One-Time Password) manager built with HTML, JavaScript, and Bootstrap. This application allows users to manage TOTP accounts, organize them in folders, and generate time-based authentication codes.

## Features Specification

### Core Features
1. **Account Management**
   - Add new OTP accounts with name, service type, email, and secret key
   - Edit existing accounts
   - Delete accounts with confirmation
   - Store data locally in browser

2. **OTP Code Generation** 
   - Generate TOTP codes using standard algorithm (RFC 6238)
   - 30-second refresh interval
   - Visual countdown timer for code expiry
   - Copy codes to clipboard functionality

3. **Folder Organization**
   - Create custom folders for account organization
   - Move accounts between folders
   - Nested folder structure support
   - Default "Uncategorized" folder

4. **Search and Filtering**
   - Real-time search across account names and services
   - Filter by service type
   - Sort accounts alphabetically or by creation date

5. **User Interface**
   - Clean Bootstrap-based design
   - Responsive layout for mobile and desktop
   - Modal dialogs for forms
   - Visual feedback for user actions

## Technical Architecture

### Frontend Technologies
- **HTML5**: Structure and semantic markup
- **CSS3**: Custom styling with Bootstrap framework
- **JavaScript (ES6+)**: Core functionality and DOM manipulation
- **Bootstrap 5**: UI components and responsive grid system

### Key Components
1. **OTPManager Class**: Core business logic for account management
2. **TOTPGenerator Class**: Time-based OTP algorithm implementation  
3. **FolderManager Class**: Folder organization and hierarchy management
4. **UIController Class**: DOM manipulation and event handling
5. **StorageManager Class**: Local storage operations

### Data Structure
```javascript
Account {
  id: string,
  name: string,
  service: string, 
  email: string,
  secret: string,
  folderId: string,
  createdAt: Date
}

Folder {
  id: string,
  name: string,
  parentId: string | null,
  createdAt: Date
}
```

### Security Considerations
- Secret keys stored in browser's localStorage (client-side only)
- No data transmission to external servers
- Base32 secret key validation
- Input sanitization for XSS prevention

## Development Milestones

### Phase 1: Foundation (Day 1)
- [x] Project setup and documentation
- [ ] Basic HTML structure with Bootstrap
- [ ] Core CSS styling
- [ ] Initial JavaScript framework

### Phase 2: Core Functionality (Day 2)
- [ ] TOTP algorithm implementation
- [ ] Account CRUD operations
- [ ] Local storage integration
- [ ] Basic UI forms and modals

### Phase 3: Advanced Features (Day 3)
- [ ] Folder management system
- [ ] Search and filtering
- [ ] Sorting capabilities
- [ ] Drag-and-drop reordering

### Phase 4: Polish and Testing (Day 4)
- [ ] UI/UX improvements
- [ ] Error handling and validation
- [ ] Performance optimization
- [ ] Cross-browser testing

## File Structure
```
otp-ui/
├── index.html          # Main application page
├── css/
│   └── styles.css      # Custom styles
├── js/
│   ├── app.js          # Main application logic
│   ├── totp.js         # TOTP algorithm implementation
│   ├── storage.js      # Local storage management
│   └── ui.js           # UI controllers
└── docs/
    └── PROJECT_DOCUMENTATION.md
```

## Future Enhancements
- Export/import functionality
- Backup and restore features
- Dark mode theme
- Mobile app version
- Encryption for stored secrets
- QR code scanning for easy setup

## Development Notes
- Follow Arabic user's language preference for UI text
- Maintain English documentation and code comments
- Use double quotes for strings consistently
- Implement proper error handling and user feedback
- Ensure responsive design for all screen sizes

---
*Project started: August 26, 2025*
*Last updated: August 26, 2025*