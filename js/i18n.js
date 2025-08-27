class I18nManager {
    constructor() {
        this.currentLanguage = 'en';
        this.defaultLanguage = 'en';
        this.translations = {};
        this.fallbackTranslations = {};
        this.isExtension = typeof chrome !== 'undefined' && chrome.storage;
        
        this.init();
    }

    async init() {
        await this.loadTranslations();
        await this.loadUserLanguagePreference();
        this.applyLanguage();
    }

    async loadTranslations() {
        try {
            // Load available translations
            const languages = ['en', 'ar'];
            
            for (const lang of languages) {
                const response = await fetch(`locales/${lang}.json`);
                if (response.ok) {
                    this.translations[lang] = await response.json();
                    
                    // Set default language translations as fallback
                    if (lang === this.defaultLanguage) {
                        this.fallbackTranslations = this.translations[lang];
                    }
                }
            }
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to built-in translations
            this.loadBuiltInTranslations();
        }
    }

    loadBuiltInTranslations() {
        // Built-in fallback translations
        this.translations = {
            en: {
                app_title: "Twin Key - 2FA Manager",
                add_account: "Add Account",
                add_folder: "Add Folder",
                folders: "Folders",
                all_accounts: "All Accounts",
                uncategorized: "Uncategorized",
                search_placeholder: "Search for account...",
                sort_by_name: "Sort by Name",
                sort_by_service: "Sort by Service",
                sort_by_created: "Sort by Creation Date",
                last_update: "Last update",
                now: "now",
                no_accounts: "No accounts yet",
                add_first_account: "Add first account",
                no_search_results: "No search results",
                account_name: "Account Name",
                service_type: "Service Type",
                email: "Email",
                secret_key: "Secret Key",
                secret_key_help: "Enter the 32-character secret key",
                folder: "Folder",
                cancel: "Cancel",
                add: "Add",
                close: "Close",
                edit: "Edit",
                delete: "Delete",
                account_details: "Account Details",
                service: "Service",
                last_used: "Last Used",
                never_used: "Never used",
                copy: "Copy",
                settings: "Settings",
                language: "Language",
                theme: "Theme",
                auto_refresh: "Auto Refresh",
                show_emails: "Show Emails",
                choose_service: "Choose Service",
                google: "Google",
                microsoft: "Microsoft",
                github: "GitHub",
                facebook: "Facebook",
                twitter: "Twitter",
                discord: "Discord",
                amazon: "Amazon",
                other: "Other",
                success_account_added: "Account added successfully",
                success_account_copied: "OTP code copied",
                error_fill_fields: "Please fill all fields",
                error_invalid_secret: "Invalid secret key",
                error_adding_account: "Failed to add account",
                error_copying_code: "Failed to copy code",
                new_folder: "New Folder",
                folder_name: "Folder Name"
            },
            ar: {
                app_title: "مدير رموز OTP",
                add_account: "إضافة حساب",
                add_folder: "إضافة مجلد",
                folders: "المجلدات",
                all_accounts: "جميع الحسابات",
                uncategorized: "غير مصنف",
                search_placeholder: "البحث عن حساب...",
                sort_by_name: "ترتيب حسب الاسم",
                sort_by_service: "ترتيب حسب الخدمة",
                sort_by_created: "ترتيب حسب تاريخ الإنشاء",
                last_update: "آخر تحديث",
                now: "الآن",
                no_accounts: "لا توجد حسابات بعد",
                add_first_account: "إضافة أول حساب",
                no_search_results: "لا توجد نتائج للبحث",
                account_name: "اسم الحساب",
                service_type: "نوع الخدمة",
                email: "البريد الإلكتروني",
                secret_key: "المفتاح السري",
                secret_key_help: "أدخل المفتاح السري المكون من 32 حرف",
                folder: "المجلد",
                cancel: "إلغاء",
                add: "إضافة",
                close: "إغلاق",
                edit: "تعديل",
                delete: "حذف",
                account_details: "تفاصيل الحساب",
                service: "الخدمة",
                last_used: "آخر استخدام",
                never_used: "لم يستخدم بعد",
                copy: "نسخ",
                settings: "الإعدادات",
                language: "اللغة",
                theme: "المظهر",
                auto_refresh: "التحديث التلقائي",
                show_emails: "إظهار البريد الإلكتروني",
                choose_service: "اختر الخدمة",
                google: "Google",
                microsoft: "Microsoft",
                github: "GitHub",
                facebook: "Facebook",
                twitter: "Twitter",
                discord: "Discord",
                amazon: "Amazon",
                other: "أخرى",
                success_account_added: "تم إضافة الحساب بنجاح",
                success_account_copied: "تم نسخ كود OTP",
                error_fill_fields: "يرجى ملء جميع الحقول",
                error_invalid_secret: "المفتاح السري غير صحيح",
                error_adding_account: "فشل في إضافة الحساب",
                error_copying_code: "فشل في نسخ الكود",
                new_folder: "مجلد جديد",
                folder_name: "اسم المجلد"
            }
        };
        
        this.fallbackTranslations = this.translations[this.defaultLanguage];
    }

    async loadUserLanguagePreference() {
        try {
            if (this.isExtension && chrome.storage) {
                const result = await chrome.storage.local.get('language');
                this.currentLanguage = result.language || await this.detectBrowserLanguage();
            } else {
                const savedLanguage = localStorage.getItem('otp_language');
                this.currentLanguage = savedLanguage || await this.detectBrowserLanguage();
            }
        } catch (error) {
            console.error('Error loading language preference:', error);
            this.currentLanguage = await this.detectBrowserLanguage();
        }
    }

    async detectBrowserLanguage() {
        const browserLang = navigator.language || navigator.languages[0] || 'en';
        const langCode = browserLang.split('-')[0].toLowerCase();
        
        // Check if we support this language
        return this.translations[langCode] ? langCode : this.defaultLanguage;
    }

    async setLanguage(languageCode) {
        if (!this.translations[languageCode]) {
            console.warn(`Language ${languageCode} not available, falling back to ${this.defaultLanguage}`);
            languageCode = this.defaultLanguage;
        }

        this.currentLanguage = languageCode;
        
        // Save preference
        try {
            if (this.isExtension && chrome.storage) {
                await chrome.storage.local.set({ language: languageCode });
            } else {
                localStorage.setItem('otp_language', languageCode);
            }
        } catch (error) {
            console.error('Error saving language preference:', error);
        }

        this.applyLanguage();
    }

    applyLanguage() {
        // Update HTML lang and dir attributes
        const html = document.documentElement;
        html.setAttribute('lang', this.currentLanguage);
        html.setAttribute('dir', this.isRTL() ? 'rtl' : 'ltr');

        // Update all elements with data-i18n attributes
        const elementsToTranslate = document.querySelectorAll('[data-i18n]');
        elementsToTranslate.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);
            
            // Check if it's a placeholder
            if (element.hasAttribute('placeholder')) {
                element.setAttribute('placeholder', translation);
            } else {
                element.textContent = translation;
            }
        });

        // Update elements with data-i18n-title attributes
        const elementsWithTitle = document.querySelectorAll('[data-i18n-title]');
        elementsWithTitle.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.setAttribute('title', this.translate(key));
        });

        // Switch CSS for RTL/LTR
        this.updateDirectionStyles();

        // Trigger custom event for language change
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: this.currentLanguage, isRTL: this.isRTL() }
        }));
    }

    translate(key, params = {}) {
        let translation = this.translations[this.currentLanguage]?.[key] || 
                         this.fallbackTranslations[key] || 
                         key;

        // Replace parameters in translation
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{{${param}}}`, params[param]);
        });

        return translation;
    }

    t(key, params = {}) {
        return this.translate(key, params);
    }

    isRTL() {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
        return rtlLanguages.includes(this.currentLanguage);
    }

    updateDirectionStyles() {
        const isRTL = this.isRTL();
        
        // Update Bootstrap CSS
        const bootstrapLinks = document.querySelectorAll('link[href*="bootstrap"]');
        bootstrapLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (isRTL && !href.includes('.rtl.')) {
                // Switch to RTL Bootstrap
                link.setAttribute('href', href.replace('bootstrap.min.css', 'bootstrap.rtl.min.css'));
            } else if (!isRTL && href.includes('.rtl.')) {
                // Switch to LTR Bootstrap
                link.setAttribute('href', href.replace('bootstrap.rtl.min.css', 'bootstrap.min.css'));
            }
        });

        // Add/remove RTL class to body
        document.body.classList.toggle('rtl', isRTL);
        document.body.classList.toggle('ltr', !isRTL);
    }

    getAvailableLanguages() {
        return Object.keys(this.translations).map(code => ({
            code,
            name: this.getLanguageName(code),
            nativeName: this.getNativeLanguageName(code),
            isRTL: ['ar', 'he', 'fa', 'ur'].includes(code)
        }));
    }

    getLanguageName(code) {
        const names = {
            en: 'English',
            ar: 'Arabic',
            es: 'Spanish',
            fr: 'French',
            de: 'German',
            it: 'Italian',
            pt: 'Portuguese',
            ru: 'Russian',
            zh: 'Chinese',
            ja: 'Japanese',
            ko: 'Korean'
        };
        return names[code] || code.toUpperCase();
    }

    getNativeLanguageName(code) {
        const nativeNames = {
            en: 'English',
            ar: 'العربية',
            es: 'Español',
            fr: 'Français',
            de: 'Deutsch',
            it: 'Italiano',
            pt: 'Português',
            ru: 'Русский',
            zh: '中文',
            ja: '日本語',
            ko: '한국어'
        };
        return nativeNames[code] || code.toUpperCase();
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Method to add translations dynamically
    addTranslations(languageCode, translations) {
        if (!this.translations[languageCode]) {
            this.translations[languageCode] = {};
        }
        
        Object.assign(this.translations[languageCode], translations);
    }

    // Method to format dates according to current locale
    formatDate(date, options = {}) {
        const locale = this.currentLanguage === 'ar' ? 'ar-SA' : this.currentLanguage;
        return new Date(date).toLocaleDateString(locale, options);
    }

    // Method to format numbers according to current locale
    formatNumber(number) {
        const locale = this.currentLanguage === 'ar' ? 'ar-SA' : this.currentLanguage;
        return new Intl.NumberFormat(locale).format(number);
    }
}

// Global instance
window.i18n = new I18nManager();