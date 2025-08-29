class I18nManager {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.isExtension = typeof chrome !== 'undefined' && chrome.storage;
        
        this.init();
    }

    async init() {
        await this.loadTranslations();
        this.applyLanguage();
    }

    async loadTranslations() {
        try {
            // Load English translations
            const response = await fetch('./locales/en.json');
            const translations = await response.json();
            this.translations = translations;
        } catch (error) {
            console.error('Failed to load translations:', error);
            // Fallback translations
            this.translations = {
                app_title: "Twin Key",
                add_account: "Add Account",
                no_accounts: "No accounts yet",
                search_placeholder: "Search for account...",
                account_name: "Account Name",
                service_type: "Service Type",
                email: "Email",
                secret_key: "Secret Key",
                secret_key_help: "32-character Base32",
                add: "Add",
                cancel: "Cancel",
                copy: "Copy",
                service: "Service",
                last_used: "Last Used",
                never_used: "Never used",
                success_account_added: "Account added successfully",
                success_account_copied: "OTP code copied for {{name}}",
                error_fill_fields: "Please fill all fields",
                error_invalid_secret: "Invalid secret key",
                error_adding_account: "Failed to add account",
                error_copying_code: "Failed to copy code"
            };
        }
    }

    applyLanguage() {
        // Apply translations to data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email' || element.type === 'search')) {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Set document title
        const titleElement = document.querySelector('title[data-i18n]');
        if (titleElement) {
            const key = titleElement.getAttribute('data-i18n');
            document.title = this.t(key);
        }

        // Set document language and direction
        document.documentElement.lang = 'en';
        document.documentElement.dir = 'ltr';
        document.body.setAttribute('data-bs-theme', 'light');

        // Ensure Bootstrap LTR is loaded
        this.ensureBootstrapLTR();
    }

    ensureBootstrapLTR() {
        // Remove any RTL Bootstrap if present
        const rtlLink = document.querySelector('link[href*="bootstrap.rtl"]');
        if (rtlLink) {
            rtlLink.remove();
        }

        // Ensure LTR Bootstrap is present
        if (!document.querySelector('link[href*="bootstrap"][href*="min.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
            document.head.appendChild(link);
        }
    }

    t(key, defaultValue = '') {
        if (this.translations && this.translations[key]) {
            return this.translations[key];
        }
        return defaultValue || key;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Placeholder for future language switching
    async setLanguage(languageCode) {
        if (languageCode === 'en') {
            this.currentLanguage = languageCode;
            this.applyLanguage();
        }
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US');
        } catch (error) {
            return dateString;
        }
    }
}

// Initialize and make globally available
const i18n = new I18nManager();
window.i18n = i18n;