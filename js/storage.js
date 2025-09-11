// TwinKey Storage Manager for accounts and folders

class StorageManager {
    constructor() {
        this.accountsKey = "otp_accounts";
        this.foldersKey = "otp_folders";
        this.settingsKey = "otp_settings";
        this.isExtension = typeof chrome !== 'undefined' && chrome.storage;
        this.cryptoManager = null;
        this.isEncryptionEnabled = false;
        
        // Initialize default data if not exists
        this.initializeDefaults();
    }

    /**
     * Initialize crypto manager for secure storage
     */
    async initializeCrypto(cryptoManager) {
        this.cryptoManager = cryptoManager;
        this.isEncryptionEnabled = true;
        
        // Check if we have encrypted data and need authentication
        const accounts = await this.getAccounts();
        return accounts;
    }

    /**
     * Initialize default folders and settings
     */
    async initializeDefaults() {
        const folders = await this.getFolders();
        if (!folders.length) {
            // Create default uncategorized folder
            await this.addFolder({
                id: "uncategorized",
                name: "Uncategorized",
                parentId: null,
                createdAt: new Date().toISOString()
            });
        }

        const settings = await this.getSettings();
        if (!settings) {
            await this.saveSettings({
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
     * @returns {Promise<Array>} Array of account objects
     */
    async getAccounts() {
        try {
            if (this.isExtension) {
                const result = await chrome.storage.local.get(this.accountsKey);
                return result[this.accountsKey] || [];
            } else {
                const accounts = localStorage.getItem(this.accountsKey);
                return accounts ? JSON.parse(accounts) : [];
            }
        } catch (error) {
            console.error("Error reading accounts:", error);
            return [];
        }
    }

    /**
     * Save accounts array to storage
     * @param {Array} accounts - Array of account objects
     * @returns {Promise<boolean>} Success status
     */
    async saveAccounts(accounts) {
        try {
            if (this.isExtension) {
                await chrome.storage.local.set({ [this.accountsKey]: accounts });
                return true;
            } else {
                localStorage.setItem(this.accountsKey, JSON.stringify(accounts));
                return true;
            }
        } catch (error) {
            console.error("Error saving accounts:", error);
            return false;
        }
    }

    /**
     * Add new account
     * @param {Object} account - Account object
     * @returns {Promise<string|null>} Account ID if successful, null otherwise
     */
    async addAccount(account) {
        try {
            const accounts = await this.getAccounts();
            
            // Encrypt the secret if crypto is enabled
            let secret = account.secret;
            if (this.isEncryptionEnabled && this.cryptoManager && this.cryptoManager.isAuthenticated()) {
                secret = await this.cryptoManager.encrypt(account.secret);
            }
            
            const newAccount = {
                id: account.id || this.generateId(),
                name: account.name,
                service: account.service,
                email: account.email,
                secret: secret,
                encrypted: this.isEncryptionEnabled && this.cryptoManager && this.cryptoManager.isAuthenticated(),
                folderId: account.folderId || "uncategorized",
                sortOrder: account.sortOrder !== undefined ? account.sortOrder : accounts.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastUsed: account.lastUsed || null
            };

            accounts.push(newAccount);
            const success = await this.saveAccounts(accounts);
            return success ? newAccount.id : null;
        } catch (error) {
            console.error("Error adding account:", error);
            return null;
        }
    }

    /**
     * Update existing account
     * @param {string} accountId - Account ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<boolean>} Success status
     */
    async updateAccount(accountId, updates) {
        try {
            const accounts = await this.getAccounts();
            const index = accounts.findIndex(acc => acc.id === accountId);
            
            if (index === -1) {
                return false;
            }

            accounts[index] = {
                ...accounts[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            return await this.saveAccounts(accounts);
        } catch (error) {
            console.error("Error updating account:", error);
            return false;
        }
    }

    /**
     * Delete account
     * @param {string} accountId - Account ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteAccount(accountId) {
        try {
            const accounts = await this.getAccounts();
            const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
            return await this.saveAccounts(filteredAccounts);
        } catch (error) {
            console.error("Error deleting account:", error);
            return false;
        }
    }

    /**
     * Get account by ID
     * @param {string} accountId - Account ID
     * @returns {Promise<Object|null>} Account object or null
     */
    async getAccount(accountId) {
        try {
            const accounts = await this.getAccounts();
            return accounts.find(acc => acc.id === accountId) || null;
        } catch (error) {
            console.error("Error getting account:", error);
            return null;
        }
    }

    /**
     * Get decrypted secret for an account
     * @param {string} accountId - Account ID
     * @returns {Promise<string|null>} Decrypted secret or null
     */
    async getDecryptedSecret(accountId) {
        try {
            const account = await this.getAccount(accountId);
            if (!account) return null;

            // If account is encrypted, decrypt the secret
            if (account.encrypted && this.cryptoManager && this.cryptoManager.isAuthenticated()) {
                return await this.cryptoManager.decrypt(account.secret);
            }

            // Return plain secret if not encrypted
            return account.secret;
        } catch (error) {
            console.error("Error getting decrypted secret:", error);
            return null;
        }
    }

    /**
     * Get accounts by folder ID
     * @param {string} folderId - Folder ID
     * @returns {Promise<Array>} Array of accounts
     */
    async getAccountsByFolder(folderId) {
        try {
            const accounts = await this.getAccounts();
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
     * @returns {Promise<Array>} Array of folder objects
     */
    async getFolders() {
        try {
            if (this.isExtension) {
                const result = await chrome.storage.local.get(this.foldersKey);
                return result[this.foldersKey] || [];
            } else {
                const folders = localStorage.getItem(this.foldersKey);
                return folders ? JSON.parse(folders) : [];
            }
        } catch (error) {
            console.error("Error reading folders:", error);
            return [];
        }
    }

    /**
     * Save folders array to storage
     * @param {Array} folders - Array of folder objects
     * @returns {Promise<boolean>} Success status
     */
    async saveFolders(folders) {
        try {
            if (this.isExtension) {
                await chrome.storage.local.set({ [this.foldersKey]: folders });
                return true;
            } else {
                localStorage.setItem(this.foldersKey, JSON.stringify(folders));
                return true;
            }
        } catch (error) {
            console.error("Error saving folders:", error);
            return false;
        }
    }

    /**
     * Add new folder
     * @param {Object} folder - Folder object
     * @returns {Promise<string|null>} Folder ID if successful, null otherwise
     */
    async addFolder(folder) {
        try {
            const folders = await this.getFolders();
            const newFolder = {
                id: folder.id || this.generateId(),
                name: folder.name,
                parentId: folder.parentId || null,
                createdAt: folder.createdAt || new Date().toISOString()
            };

            folders.push(newFolder);
            const success = await this.saveFolders(folders);
            return success ? newFolder.id : null;
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
    async updateFolder(folderId, updates) {
        try {
            const folders = await this.getFolders();
            const index = folders.findIndex(folder => folder.id === folderId);
            
            if (index === -1) {
                return false;
            }

            folders[index] = {
                ...folders[index],
                ...updates
            };

            return await this.saveFolders(folders);
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
    async deleteFolder(folderId) {
        try {
            // Can't delete default folders
            if (folderId === "uncategorized" || folderId === "all") {
                return false;
            }

            // Move all accounts from this folder to uncategorized
            const accounts = await this.getAccounts();
            accounts.forEach(account => {
                if (account.folderId === folderId) {
                    account.folderId = "uncategorized";
                }
            });
            await this.saveAccounts(accounts);

            // Remove folder
            const folders = await this.getFolders();
            const filteredFolders = folders.filter(folder => folder.id !== folderId);
            return await this.saveFolders(filteredFolders);
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
    async getFolder(folderId) {
        try {
            const folders = await this.getFolders();
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
     * @returns {Promise<Object|null>} Settings object
     */
    async getSettings() {
        try {
            if (this.isExtension) {
                const result = await chrome.storage.local.get(this.settingsKey);
                return result[this.settingsKey] || null;
            } else {
                const settings = localStorage.getItem(this.settingsKey);
                return settings ? JSON.parse(settings) : null;
            }
        } catch (error) {
            console.error("Error reading settings:", error);
            return null;
        }
    }

    /**
     * Save application settings
     * @param {Object} settings - Settings object
     * @returns {Promise<boolean>} Success status
     */
    async saveSettings(settings) {
        try {
            if (this.isExtension) {
                await chrome.storage.local.set({ [this.settingsKey]: settings });
                return true;
            } else {
                localStorage.setItem(this.settingsKey, JSON.stringify(settings));
                return true;
            }
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
    async searchAccounts(query) {
        try {
            const accounts = await this.getAccounts();
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
     * @param {string} exportPassword - Optional password to encrypt the export
     * @returns {Promise<Object>} Exported data
     */
    async exportData(exportPassword = null) {
        try {
            // Get raw data with decrypted secrets for re-encryption with export password
            const rawData = await this.getRawDataForExport();
            
            const exportData = {
                accounts: rawData.accounts,
                folders: await this.getFolders(),
                settings: await this.getSettings(),
                exportedAt: new Date().toISOString(),
                version: "1.1",
                encrypted: !!exportPassword
            };

            // If export password provided, encrypt the data
            if (exportPassword) {
                exportData.encryptedData = await this.encryptExportData(exportData, exportPassword);
                // Remove the raw data, keep only encrypted version
                delete exportData.accounts;
                delete exportData.folders;
                delete exportData.settings;
            }

            return exportData;
        } catch (error) {
            console.error("Error exporting data:", error);
            return null;
        }
    }

    /**
     * Get raw data for export with decrypted secrets
     * @returns {Promise<Object>} Raw data with decrypted secrets
     */
    async getRawDataForExport() {
        try {
            const accounts = await this.getAccounts();
            const decryptedAccounts = [];

            for (const account of accounts) {
                const decryptedAccount = { ...account };
                
                // If account is encrypted, decrypt the secret for export
                if (account.encrypted && this.cryptoManager && this.cryptoManager.isAuthenticated()) {
                    try {
                        decryptedAccount.secret = await this.cryptoManager.decrypt(account.secret);
                        decryptedAccount.encrypted = false; // Mark as decrypted in export
                    } catch (error) {
                        console.error("Failed to decrypt account secret:", error);
                        // Keep encrypted if decryption fails
                    }
                }
                
                decryptedAccounts.push(decryptedAccount);
            }

            return {
                accounts: decryptedAccounts
            };
        } catch (error) {
            console.error("Error getting raw data for export:", error);
            throw error;
        }
    }

    /**
     * Encrypt export data with password
     * @param {Object} data - Data to encrypt
     * @param {string} password - Export password
     * @returns {Promise<string>} Encrypted data string
     */
    async encryptExportData(data, password) {
        try {
            // Create a temporary crypto manager for export encryption
            const exportCrypto = new CryptoManager();
            await exportCrypto.generateEncryptionKey(password);
            
            const dataToEncrypt = {
                accounts: data.accounts,
                folders: data.folders,
                settings: data.settings
            };

            return await exportCrypto.encrypt(JSON.stringify(dataToEncrypt));
        } catch (error) {
            console.error("Error encrypting export data:", error);
            throw error;
        }
    }

    /**
     * Import data
     * @param {Object} data - Data to import
     * @param {string} importPassword - Password for encrypted imports
     * @returns {Promise<boolean>} Success status
     */
    async importData(data, importPassword = null) {
        try {
            let importData = data;

            // If data is encrypted, decrypt it first
            if (data.encrypted && data.encryptedData) {
                if (!importPassword) {
                    throw new Error("Password required for encrypted import");
                }
                
                importData = await this.decryptImportData(data.encryptedData, importPassword);
            }

            if (importData.accounts) {
                // If crypto is enabled, encrypt the secrets during import
                if (this.isEncryptionEnabled && this.cryptoManager && this.cryptoManager.isAuthenticated()) {
                    const encryptedAccounts = await Promise.all(
                        importData.accounts.map(async (account) => {
                            if (!account.encrypted && account.secret) {
                                // Encrypt the secret with current user's password
                                const encryptedSecret = await this.cryptoManager.encrypt(account.secret);
                                return {
                                    ...account,
                                    secret: encryptedSecret,
                                    encrypted: true
                                };
                            }
                            return account;
                        })
                    );
                    await this.saveAccounts(encryptedAccounts);
                } else {
                    await this.saveAccounts(importData.accounts);
                }
            }
            if (importData.folders) {
                await this.saveFolders(importData.folders);
            }
            if (importData.settings) {
                await this.saveSettings(importData.settings);
            }
            return true;
        } catch (error) {
            console.error("Error importing data:", error);
            return false;
        }
    }

    /**
     * Decrypt import data with password
     * @param {string} encryptedData - Encrypted data string
     * @param {string} password - Import password
     * @returns {Promise<Object>} Decrypted data
     */
    async decryptImportData(encryptedData, password) {
        try {
            // Create a temporary crypto manager for import decryption
            const importCrypto = new CryptoManager();
            await importCrypto.generateEncryptionKey(password);
            
            const decryptedString = await importCrypto.decrypt(encryptedData);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error("Error decrypting import data:", error);
            throw new Error("Invalid password or corrupted data");
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