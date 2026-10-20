class I18nManager {
    constructor() {
        this.currentLanguage = "en";
        this.translations = {};
        // Callers await this instead of calling init() again
        this.ready = this.init();
    }

    async init() {
        await this.loadTranslations();
        this.applyLanguage();
    }

    async loadTranslations() {
        try {
            const response = await fetch("./locales/en.json");
            this.translations = await response.json();
        } catch (error) {
            console.error("Failed to load translations:", error);
            this.translations = {};
        }
    }

    applyLanguage() {
        document.querySelectorAll("[data-i18n]").forEach(element => {
            const translation = this.t(element.getAttribute("data-i18n"));
            if (element.tagName === "INPUT" && ["text", "email", "search"].includes(element.type)) {
                element.placeholder = translation;
            } else if (element.tagName === "TITLE") {
                document.title = translation;
            } else {
                element.textContent = translation;
            }
        });
    }

    /**
     * Translate a key. Second argument is either {{placeholder}} values or a fallback string.
     * @param {string} key
     * @param {Object|string} params
     */
    t(key, params = {}) {
        const fallback = typeof params === "string" ? params : "";
        const values = typeof params === "object" && params !== null ? params : {};
        const text = this.translations[key] || fallback || key;
        return text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in values ? String(values[name]) : match));
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString("en-US");
        } catch (error) {
            return dateString;
        }
    }
}

// Initialize and make globally available
window.i18n = new I18nManager();
