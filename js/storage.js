// Local Storage Manager for OTP accounts and folders

class StorageManager {
    constructor() {
        this.accountsKey = "otp_accounts";
        this.foldersKey = "otp_folders";
        this.settingsKey = "otp_settings";
        
        // Initialize default data if not exists
        this.initializeDefaults();
    }

    /**
     * Initialize default folders and settings
     */
    initializeDefaults() {
        if (!this.getFolders().length) {
            // Create default uncategorized folder
            this.addFolder({
                id: "uncategorized",
                name: "غير مصنف",
                parentId: null,
                createdAt: new Date().toISOString()
            });
        }

        if (!this.getSettings()) {
            this.saveSettings({
                theme: "light",
                autoRefresh: true,
                refreshInterval: 30,
                showEmails: true,
                sortBy: "name",
                lastBackup: null
            });
        }
    }

    // ===============================
    // Account Management Methods
    // ===============================

    /**
     * Get all accounts
     * @returns {Array} Array of account objects
     */
    getAccounts() {
        try {
            const accounts = localStorage.getItem(this.accountsKey);
            return accounts ? JSON.parse(accounts) : [];
        } catch (error) {
            console.error("Error reading accounts:", error);
            return [];
        }
    }

    /**
     * Save accounts array to storage
     * @param {Array} accounts - Array of account objects
     */
    saveAccounts(accounts) {
        try {
            localStorage.setItem(this.accountsKey, JSON.stringify(accounts));
            return true;
        } catch (error) {
            console.error("Error saving accounts:", error);
            return false;
        }
    }

    /**
     * Add new account
     * @param {Object} account - Account object
     * @returns {string|null} Account ID if successful, null otherwise
     */
    addAccount(account) {
        try {
            const accounts = this.getAccounts();
            const newAccount = {
                id: this.generateId(),
                name: account.name,
                service: account.service,
                email: account.email,
                secret: account.secret,
                folderId: account.folderId || "uncategorized",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            accounts.push(newAccount);
            this.saveAccounts(accounts);
            return newAccount.id;
        } catch (error) {
            console.error("Error adding account:", error);
            return null;
        }
    }

    /**
     * Update existing account
     * @param {string} accountId - Account ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateAccount(accountId, updates) {
        try {
            const accounts = this.getAccounts();
            const index = accounts.findIndex(acc => acc.id === accountId);
            
            if (index === -1) {
                return false;
            }

            accounts[index] = {
                ...accounts[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            return this.saveAccounts(accounts);
        } catch (error) {
            console.error("Error updating account:", error);
            return false;
        }
    }

    /**
     * Delete account
     * @param {string} accountId - Account ID
     * @returns {boolean} Success status
     */
    deleteAccount(accountId) {
        try {
            const accounts = this.getAccounts();
            const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
            return this.saveAccounts(filteredAccounts);
        } catch (error) {
            console.error("Error deleting account:", error);
            return false;
        }
    }

    /**
     * Get account by ID
     * @param {string} accountId - Account ID
     * @returns {Object|null} Account object or null
     */
    getAccount(accountId) {
        try {
            const accounts = this.getAccounts();
            return accounts.find(acc => acc.id === accountId) || null;
        } catch (error) {
            console.error("Error getting account:", error);
            return null;
        }
    }

    /**
     * Get accounts by folder ID
     * @param {string} folderId - Folder ID
     * @returns {Array} Array of accounts
     */
    getAccountsByFolder(folderId) {
        try {
            const accounts = this.getAccounts();
            if (folderId === "all") {
                return accounts;
            }
            return accounts.filter(acc => acc.folderId === folderId);
        } catch (error) {
            console.error("Error getting accounts by folder:", error);
            return [];
        }
    }

    // ===============================
    // Folder Management Methods
    // ===============================

    /**
     * Get all folders
     * @returns {Array} Array of folder objects
     */
    getFolders() {
        try {
            const folders = localStorage.getItem(this.foldersKey);
            return folders ? JSON.parse(folders) : [];
        } catch (error) {
            console.error("Error reading folders:", error);
            return [];
        }
    }

    /**
     * Save folders array to storage
     * @param {Array} folders - Array of folder objects
     */
    saveFolders(folders) {
        try {
            localStorage.setItem(this.foldersKey, JSON.stringify(folders));
            return true;
        } catch (error) {
            console.error("Error saving folders:", error);
            return false;
        }
    }

    /**
     * Add new folder
     * @param {Object} folder - Folder object
     * @returns {string|null} Folder ID if successful, null otherwise
     */
    addFolder(folder) {
        try {
            const folders = this.getFolders();
            const newFolder = {
                id: folder.id || this.generateId(),
                name: folder.name,
                parentId: folder.parentId || null,
                createdAt: folder.createdAt || new Date().toISOString()
            };

            folders.push(newFolder);
            this.saveFolders(folders);
            return newFolder.id;
        } catch (error) {
            console.error("Error adding folder:", error);
            return null;
        }
    }

    /**
     * Update folder
     * @param {string} folderId - Folder ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean} Success status
     */
    updateFolder(folderId, updates) {
        try {
            const folders = this.getFolders();
            const index = folders.findIndex(folder => folder.id === folderId);
            
            if (index === -1) {
                return false;
            }

            folders[index] = {
                ...folders[index],
                ...updates
            };

            return this.saveFolders(folders);
        } catch (error) {
            console.error("Error updating folder:", error);
            return false;
        }
    }

    /**
     * Delete folder and move accounts to uncategorized
     * @param {string} folderId - Folder ID
     * @returns {boolean} Success status
     */
    deleteFolder(folderId) {
        try {
            // Can"t delete default folders
            if (folderId === "uncategorized" || folderId === "all") {
                return false;
            }

            // Move all accounts from this folder to uncategorized
            const accounts = this.getAccounts();
            accounts.forEach(account => {
                if (account.folderId === folderId) {
                    account.folderId = "uncategorized";
                }
            });
            this.saveAccounts(accounts);

            // Remove folder
            const folders = this.getFolders();
            const filteredFolders = folders.filter(folder => folder.id !== folderId);
            return this.saveFolders(filteredFolders);
        } catch (error) {
            console.error("Error deleting folder:", error);
            return false;
        }
    }

    /**
     * Get folder by ID
     * @param {string} folderId - Folder ID
     * @returns {Object|null} Folder object or null
     */
    getFolder(folderId) {
        try {
            const folders = this.getFolders();
            return folders.find(folder => folder.id === folderId) || null;
        } catch (error) {
            console.error("Error getting folder:", error);
            return null;
        }
    }

    // ===============================
    // Settings Management
    // ===============================

    /**
     * Get application settings
     * @returns {Object|null} Settings object
     */
    getSettings() {
        try {
            const settings = localStorage.getItem(this.settingsKey);
            return settings ? JSON.parse(settings) : null;
        } catch (error) {
            console.error("Error reading settings:", error);
            return null;
        }
    }

    /**
     * Save application settings
     * @param {Object} settings - Settings object
     * @returns {boolean} Success status
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error("Error saving settings:", error);
            return false;
        }
    }

    // ===============================
    // Search and Filter Methods
    // ===============================

    /**
     * Search accounts by name, service, or email
     * @param {string} query - Search query
     * @returns {Array} Filtered accounts
     */
    searchAccounts(query) {
        try {
            const accounts = this.getAccounts();
            if (!query) return accounts;

            const lowercaseQuery = query.toLowerCase();
            return accounts.filter(account => 
                account.name.toLowerCase().includes(lowercaseQuery) ||
                account.service.toLowerCase().includes(lowercaseQuery) ||
                account.email.toLowerCase().includes(lowercaseQuery)
            );
        } catch (error) {
            console.error("Error searching accounts:", error);
            return [];
        }
    }

    /**
     * Sort accounts by specified field
     * @param {Array} accounts - Accounts to sort
     * @param {string} sortBy - Field to sort by (name, service, created)
     * @returns {Array} Sorted accounts
     */
    sortAccounts(accounts, sortBy) {
        try {
            return [...accounts].sort((a, b) => {
                switch (sortBy) {
                    case "name":
                        return a.name.localeCompare(b.name, "ar");
                    case "service":
                        return a.service.localeCompare(b.service, "ar");
                    case "created":
                        return new Date(b.createdAt) - new Date(a.createdAt);
                    default:
                        return 0;
                }
            });
        } catch (error) {
            console.error("Error sorting accounts:", error);
            return accounts;
        }
    }

    // ===============================
    // Utility Methods
    // ===============================

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get storage usage statistics
     * @returns {Object} Storage stats
     */
    getStorageStats() {
        try {
            const accounts = this.getAccounts();
            const folders = this.getFolders();
            
            return {
                accountsCount: accounts.length,
                foldersCount: folders.length,
                totalSize: this.getStorageSize(),
                lastModified: this.getLastModified()
            };
        } catch (error) {
            console.error("Error getting storage stats:", error);
            return {
                accountsCount: 0,
                foldersCount: 0,
                totalSize: 0,
                lastModified: null
            };
        }
    }

    /**
     * Get total storage size in bytes
     * @returns {number} Storage size
     */
    getStorageSize() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key) && key.startsWith("otp_")) {
                    total += localStorage[key].length;
                }
            }
            return total;
        } catch (error) {
            console.error("Error calculating storage size:", error);
            return 0;
        }
    }

    /**
     * Get last modification date
     * @returns {string|null} ISO date string
     */
    getLastModified() {
        try {
            const accounts = this.getAccounts();
            if (!accounts.length) return null;
            
            const dates = accounts
                .map(acc => new Date(acc.updatedAt || acc.createdAt))
                .sort((a, b) => b - a);
            
            return dates[0].toISOString();
        } catch (error) {
            console.error("Error getting last modified:", error);
            return null;
        }
    }

    /**
     * Export all data
     * @returns {Object} Exported data
     */
    exportData() {
        try {
            return {
                accounts: this.getAccounts(),
                folders: this.getFolders(),
                settings: this.getSettings(),
                exportedAt: new Date().toISOString(),
                version: "1.0"
            };
        } catch (error) {
            console.error("Error exporting data:", error);
            return null;
        }
    }

    /**
     * Import data
     * @param {Object} data - Data to import
     * @returns {boolean} Success status
     */
    importData(data) {
        try {
            if (data.accounts) {
                this.saveAccounts(data.accounts);
            }
            if (data.folders) {
                this.saveFolders(data.folders);
            }
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            return true;
        } catch (error) {
            console.error("Error importing data:", error);
            return false;
        }
    }

    /**
     * Clear all data
     * @returns {boolean} Success status
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.accountsKey);
            localStorage.removeItem(this.foldersKey);
            localStorage.removeItem(this.settingsKey);
            this.initializeDefaults();
            return true;
        } catch (error) {
            console.error("Error clearing data:", error);
            return false;
        }
    }
}