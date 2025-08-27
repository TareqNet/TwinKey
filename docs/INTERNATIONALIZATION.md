# Internationalization (i18n) Guide

This guide explains how the OTP Manager supports multiple languages and how to add new translations.

## Overview

The OTP Manager now supports multiple languages through a custom internationalization system. Currently supported languages:

- **English** (en) - Default language
- **Arabic** (ar) - Right-to-left (RTL) support

## Architecture

### Core Components

1. **I18nManager** (`js/i18n.js`) - Main internationalization class
2. **Translation Files** (`locales/`) - JSON files containing translations
3. **Storage Integration** - Language preferences saved to localStorage/chrome.storage
4. **Dynamic UI Updates** - Real-time language switching

### File Structure

```
locales/
├── en.json          # English translations
├── ar.json          # Arabic translations
└── [lang].json      # Additional language files
```

## Using Translations

### HTML Attributes

Use `data-i18n` attributes for text content:

```html
<h1 data-i18n="app_title">OTP Manager</h1>
<button data-i18n="add_account">Add Account</button>
```

For placeholders, use the same attribute:

```html
<input data-i18n="search_placeholder" placeholder="Search...">
```

For title attributes:

```html
<button data-i18n-title="copy" title="Copy">
    <i class="bi bi-copy"></i>
</button>
```

### JavaScript Translations

```javascript
// Basic translation
const message = window.i18n.t('success_account_added');

// Translation with parameters
const message = window.i18n.t('success_account_copied', { name: accountName });

// Check if i18n is available (fallback)
const message = window.i18n ? window.i18n.t('error_message') : 'Default message';
```

### Common Translation Patterns

```javascript
// Toast messages
this.showToast(
    window.i18n ? window.i18n.t('success_account_added') : 'Account added successfully', 
    "success"
);

// Dynamic content rendering
const noAccountsText = window.i18n ? window.i18n.t('no_accounts') : 'No accounts';
element.innerHTML = `<p>${noAccountsText}</p>`;

// Date formatting
const formattedDate = window.i18n ? 
    window.i18n.formatDate(date) : 
    new Date(date).toLocaleDateString();
```

## Adding New Languages

### Step 1: Create Translation File

Create a new JSON file in the `locales/` directory:

```json
// locales/fr.json
{
  "app_title": "Gestionnaire OTP",
  "add_account": "Ajouter un compte",
  "email": "E-mail",
  "settings": "Paramètres",
  // ... more translations
}
```

### Step 2: Add Language Support

Update `js/i18n.js` to include the new language:

```javascript
async loadTranslations() {
    try {
        // Add new language to the list
        const languages = ['en', 'ar', 'fr']; // Add 'fr'
        
        for (const lang of languages) {
            const response = await fetch(`locales/${lang}.json`);
            if (response.ok) {
                this.translations[lang] = await response.json();
            }
        }
    } catch (error) {
        console.error('Error loading translations:', error);
        this.loadBuiltInTranslations();
    }
}
```

### Step 3: Add Language Metadata

Update the language helper methods:

```javascript
getLanguageName(code) {
    const names = {
        en: 'English',
        ar: 'Arabic',
        fr: 'French', // Add new language
        // ...
    };
    return names[code] || code.toUpperCase();
}

getNativeLanguageName(code) {
    const nativeNames = {
        en: 'English',
        ar: 'العربية',
        fr: 'Français', // Add native name
        // ...
    };
    return nativeNames[code] || code.toUpperCase();
}
```

### Step 4: Handle RTL Languages (if needed)

If the new language is RTL, add it to the RTL languages list:

```javascript
isRTL() {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur']; // Add RTL language codes
    return rtlLanguages.includes(this.currentLanguage);
}
```

## Language Switching

### Automatic Detection

The system automatically detects the user's browser language on first visit:

```javascript
async detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.languages[0] || 'en';
    const langCode = browserLang.split('-')[0].toLowerCase();
    
    // Check if we support this language
    return this.translations[langCode] ? langCode : this.defaultLanguage;
}
```

### Manual Language Switching

#### Extension Popup

Click the translate icon (🌐) in the popup header to toggle between English and Arabic.

#### Programmatic Switching

```javascript
// Switch to specific language
await window.i18n.setLanguage('ar');

// Get current language
const currentLang = window.i18n.getCurrentLanguage();

// Get available languages
const languages = window.i18n.getAvailableLanguages();
```

## RTL Support

### CSS Direction Handling

The system automatically updates CSS for RTL languages:

```css
/* Automatic direction switching */
html[dir="rtl"] body {
    text-align: right;
}

html[dir="ltr"] body {
    text-align: left;
}

/* Bootstrap RTL switching */
html[dir="rtl"] .me-2 {
    margin-left: 0.5rem !important;
    margin-right: 0;
}
```

### Bootstrap RTL

The system dynamically switches between Bootstrap versions:

- **LTR**: `bootstrap.min.css`
- **RTL**: `bootstrap.rtl.min.css`

### Special Considerations

- OTP codes remain left-to-right even in RTL languages
- Numbers and dates use locale-appropriate formatting
- Icons and UI elements flip appropriately

## Translation Keys

### Naming Conventions

- Use snake_case for consistency
- Group related keys with prefixes:
  - `error_*` - Error messages
  - `success_*` - Success messages
  - `settings_*` - Settings-related text
  - `account_*` - Account-related text

### Required Keys

Essential keys that should be present in all languages:

```json
{
  "app_title": "App Name",
  "add_account": "Add Account",
  "account_name": "Account Name",
  "service": "Service",
  "email": "Email",
  "secret_key": "Secret Key",
  "cancel": "Cancel",
  "add": "Add",
  "copy": "Copy",
  "settings": "Settings",
  "language": "Language",
  "error_fill_fields": "Please fill all fields",
  "error_invalid_secret": "Invalid secret key",
  "success_account_added": "Account added successfully"
}
```

## Best Practices

### Development

1. **Always provide fallbacks** when using translations in JavaScript
2. **Test with long text** - some languages need more space
3. **Use semantic keys** - not literal translations of English text
4. **Handle pluralization** - different languages have different plural rules

### Translation

1. **Context matters** - provide context for translators
2. **Cultural adaptation** - not just literal translation
3. **UI constraints** - consider space limitations
4. **Consistency** - use the same terms throughout

### Testing

1. **Test all languages** - ensure UI doesn't break
2. **Test RTL layout** - verify proper alignment
3. **Test language switching** - ensure smooth transitions
4. **Test fallbacks** - handle missing translations gracefully

## Troubleshooting

### Common Issues

1. **Missing translations show as keys**
   - Check if translation file exists
   - Verify JSON syntax
   - Ensure key exists in translation file

2. **RTL layout broken**
   - Check CSS direction rules
   - Verify Bootstrap RTL version loading
   - Test margin/padding directions

3. **Language not switching**
   - Check browser console for errors
   - Verify i18n initialization
   - Test storage permissions

### Debug Mode

Enable debug logging:

```javascript
// In browser console
window.i18n.debug = true;
```

## Future Enhancements

### Planned Features

1. **More languages** - Spanish, French, German
2. **Pluralization support** - Handle singular/plural forms
3. **Date/time localization** - Full locale-aware formatting
4. **Number formatting** - Locale-specific number display
5. **Chrome extension locales** - Use Chrome's built-in i18n system

### Contributing Translations

1. Fork the repository
2. Add translation file in `locales/[lang].json`
3. Update language lists in `i18n.js`
4. Test the translation
5. Submit pull request

## Chrome Extension Considerations

### Storage

- Language preferences stored in `chrome.storage.local`
- Syncs across browser sessions
- Respects extension storage quotas

### Permissions

- No additional permissions required for i18n
- Uses existing `storage` permission

### Performance

- Translation files loaded asynchronously
- Cached in memory after first load
- Minimal impact on extension startup time