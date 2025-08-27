// Main Application Entry Point for OTP Manager

class OTPManager {
    constructor() {
        this.storage = null;
        this.totp = null;
        this.ui = null;
        this.isInitialized = false;
        
        // Initialize application when DOM is ready
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the application
     */
    init() {
        try {
            console.log("Initializing OTP Manager...");
            
            // Initialize core components
            this.storage = new StorageManager();
            this.totp = new TOTPGenerator();
            this.ui = new UIController(this.storage, this.totp);
            
            // Set up global event listeners
            this.setupGlobalEventListeners();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log("OTP Manager initialized successfully");
            
            // Show welcome message for first-time users
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error("Failed to initialize OTP Manager:", error);
            this.showErrorMessage("فشل في تحميل التطبيق. يرجى تحديث الصفحة.");
        }
    }

    /**
     * Set up global event listeners
     */
    setupGlobalEventListeners() {
        // Handle page visibility changes to pause/resume OTP updates
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.pauseUpdates();
            } else {
                this.resumeUpdates();
            }
        });

        // Handle beforeunload to cleanup resources
        window.addEventListener("beforeunload", () => {
            this.cleanup();
        });

        // Handle keyboard shortcuts
        document.addEventListener("keydown", (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Handle online/offline status
        window.addEventListener("online", () => {
            this.handleOnlineStatus(true);
        });

        window.addEventListener("offline", () => {
            this.handleOnlineStatus(false);
        });

        // Prevent context menu on sensitive elements
        document.addEventListener("contextmenu", (e) => {
            if (e.target.closest(".otp-code")) {
                e.preventDefault();
            }
        });
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + N: Add new account
        if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey) {
            e.preventDefault();
            const addAccountModal = new bootstrap.Modal(document.getElementById("addAccountModal"));
            addAccountModal.show();
        }

        // Ctrl/Cmd + Shift + N: Add new folder
        if ((e.ctrlKey || e.metaKey) && e.key === "N" && e.shiftKey) {
            e.preventDefault();
            const addFolderModal = new bootstrap.Modal(document.getElementById("addFolderModal"));
            addFolderModal.show();
        }

        // Ctrl/Cmd + F: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            document.getElementById("searchInput").focus();
        }

        // Escape: Clear search
        if (e.key === "Escape" && document.activeElement.id === "searchInput") {
            document.getElementById("searchInput").value = "";
            this.ui.searchQuery = "";
            this.ui.renderAccounts();
        }
    }

    /**
     * Handle online/offline status changes
     * @param {boolean} isOnline - Online status
     */
    handleOnlineStatus(isOnline) {
        const statusIndicator = this.getOrCreateStatusIndicator();
        
        if (isOnline) {
            statusIndicator.className = "badge bg-success";
            statusIndicator.textContent = "متصل";
            setTimeout(() => statusIndicator.style.display = "none", 3000);
        } else {
            statusIndicator.className = "badge bg-warning";
            statusIndicator.textContent = "غير متصل";
            statusIndicator.style.display = "inline";
        }
    }

    /**
     * Get or create network status indicator
     * @returns {HTMLElement} Status indicator element
     */
    getOrCreateStatusIndicator() {
        let indicator = document.getElementById("networkStatus");
        if (!indicator) {
            indicator = document.createElement("span");
            indicator.id = "networkStatus";
            indicator.className = "badge bg-success";
            indicator.style.position = "fixed";
            indicator.style.top = "10px";
            indicator.style.right = "10px";
            indicator.style.zIndex = "9999";
            indicator.style.display = "none";
            document.body.appendChild(indicator);
        }
        return indicator;
    }

    /**
     * Show welcome message for new users
     */
    showWelcomeMessage() {
        const accounts = this.storage.getAccounts();
        if (accounts.length === 0) {
            setTimeout(() => {
                this.ui.showToast("مرحباً بك في مدير رموز OTP! ابدأ بإضافة أول حساب لك.", "info");
            }, 1000);
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showErrorMessage(message) {
        const errorDiv = document.createElement("div");
        errorDiv.className = "alert alert-danger alert-dismissible fade show";
        errorDiv.style.position = "fixed";
        errorDiv.style.top = "20px";
        errorDiv.style.left = "50%";
        errorDiv.style.transform = "translateX(-50%)";
        errorDiv.style.zIndex = "9999";
        errorDiv.style.minWidth = "300px";
        
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 10000);
    }

    /**
     * Pause OTP updates (when page is hidden)
     */
    pauseUpdates() {
        if (this.ui) {
            this.ui.cleanup();
        }
    }

    /**
     * Resume OTP updates (when page becomes visible)
     */
    resumeUpdates() {
        if (this.ui) {
            this.ui.startOTPUpdates();
            this.ui.renderAccounts(); // Refresh display
        }
    }

    /**
     * Get application statistics
     * @returns {Object} Application stats
     */
    getStats() {
        if (!this.isInitialized) {
            return null;
        }

        const storageStats = this.storage.getStorageStats();
        return {
            ...storageStats,
            isInitialized: this.isInitialized,
            currentFolder: this.ui.currentFolderId,
            searchActive: this.ui.searchQuery.length > 0,
            sortBy: this.ui.sortBy
        };
    }

    /**
     * Export application data
     * @returns {Object} Exported data
     */
    exportData() {
        if (!this.isInitialized) {
            throw new Error("Application not initialized");
        }

        return this.storage.exportData();
    }

    /**
     * Import application data
     * @param {Object} data - Data to import
     * @returns {boolean} Success status
     */
    importData(data) {
        if (!this.isInitialized) {
            throw new Error("Application not initialized");
        }

        const success = this.storage.importData(data);
        if (success && this.ui) {
            this.ui.loadInitialData(); // Refresh UI
        }
        
        return success;
    }

    /**
     * Clear all application data
     * @returns {boolean} Success status
     */
    clearData() {
        if (!this.isInitialized) {
            return false;
        }

        if (confirm("هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.")) {
            const success = this.storage.clearAllData();
            if (success && this.ui) {
                this.ui.loadInitialData(); // Refresh UI
                this.ui.showToast("تم حذف جميع البيانات بنجاح", "success");
            }
            return success;
        }
        
        return false;
    }

    /**
     * Get application version and info
     * @returns {Object} Application info
     */
    getAppInfo() {
        return {
            name: "مدير رموز OTP",
            version: "1.0.0",
            description: "تطبيق ويب لإدارة رموز المصادقة الثنائية",
            author: "Claude Code",
            license: "MIT",
            features: [
                "إدارة حسابات OTP",
                "تنظيم في مجلدات",
                "البحث والترشيح",
                "تحديث تلقائي للرموز",
                "نسخ سريع للرموز",
                "واجهة مستخدم عربية"
            ],
            technical: {
                storage: "Local Storage",
                algorithm: "TOTP (RFC 6238)",
                framework: "Bootstrap 5",
                security: "Client-side only"
            }
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.ui) {
            this.ui.cleanup();
        }
        
        console.log("OTP Manager cleanup completed");
    }
}

// Development tools (available in console)
const devTools = {
    /**
     * Generate test accounts for development
     * @param {number} count - Number of accounts to generate
     */
    generateTestAccounts(count = 5) {
        if (!app.isInitialized) {
            console.error("App not initialized");
            return;
        }

        const services = ["Google", "Microsoft", "GitHub", "Facebook", "Twitter"];
        const sampleSecrets = [
            "JBSWY3DPEHPK3PXP", // 'Hello'
            "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
            "MFRGG2LTMVZGS2LTMVZGS2LTMVZGS2LT",
            "NFXHA3DJMJZWG6DJNFXHA3DJMJZWG6DJ",
            "ORZHG5DJNFZWQ6DJORZHG5DJNFZWQ6DJ"
        ];

        for (let i = 0; i < count; i++) {
            const account = {
                name: `Test Account ${i + 1}`,
                service: services[i % services.length],
                email: `test${i + 1}@example.com`,
                secret: sampleSecrets[i % sampleSecrets.length],
                folderId: "uncategorized"
            };

            app.storage.addAccount(account);
        }

        app.ui.renderAccounts();
        app.ui.renderFolders();
        console.log(`Generated ${count} test accounts`);
    },

    /**
     * Clear all test data
     */
    clearTestData() {
        app.clearData();
    },

    /**
     * Show app statistics
     */
    showStats() {
        console.table(app.getStats());
    },

    /**
     * Export data to console
     */
    exportToConsole() {
        console.log("Exported Data:", JSON.stringify(app.exportData(), null, 2));
    }
};

// Initialize application
const app = new OTPManager();

// Make dev tools available in console for development
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    window.devTools = devTools;
    window.app = app;
    console.log("Dev tools available: window.devTools");
    console.log("App instance available: window.app");
}

// Service Worker registration (future enhancement)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        // Register service worker when available
        // navigator.serviceWorker.register('/sw.js');
    });
}