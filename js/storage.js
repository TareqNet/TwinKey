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
            // Fail closed: never persist a plaintext secret
            if (!this.canEncrypt()) {
                throw new Error("Not authenticated: refusing to store an unencrypted secret");
            }

            const accounts = await this.getAccounts();
            const secret = await this.cryptoManager.encrypt(account.secret);

            const newAccount = {
                id: account.id || this.generateId(),
                name: account.name,
                service: account.service,
                email: account.email,
                secret: secret,
                encrypted: true,
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

            if (account.encrypted) {
                // Locked: never hand ciphertext to the TOTP generator
                if (!this.canEncrypt()) return null;
                return await this.cryptoManager.decrypt(account.secret);
            }

            // Legacy plaintext account (created before encryption existed)
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

    canEncrypt() {
        return !!(this.isEncryptionEnabled && this.cryptoManager && this.cryptoManager.isAuthenticated());
    }

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    generateId() {
        return StorageManager.newId();
    }

    static newId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
     * @returns {Promise<{file: Object, skipped: number}|null>} Backup file and count of unreadable accounts left out
     */
    async exportData(exportPassword = null) {
        try {
            const { accounts, skipped } = await this.getRawDataForExport();
            const payload = {
                accounts: accounts,
                folders: await this.getFolders(),
                settings: await this.getSettings()
            };

            const file = {
                version: StorageManager.EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                encrypted: !!exportPassword
            };

            if (exportPassword) {
                // Standalone key: the vault's auth keys are never touched
                const salt = this.cryptoManager.generateSalt();
                const iterations = CryptoManager.EXPORT_ITERATIONS;
                const key = await this.cryptoManager.deriveKey(exportPassword, salt, iterations);
                file.kdf = {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    iterations: iterations,
                    salt: CryptoManager.bytesToBase64(salt)
                };
                file.encryptedData = await this.cryptoManager.encryptWithKey(key, JSON.stringify(payload));
            } else {
                Object.assign(file, payload);
            }

            return { file, skipped };
        } catch (error) {
            console.error("Error exporting data:", error);
            return null;
        }
    }

    /**
     * Accounts with secrets decrypted for export. Unreadable accounts are left out and counted.
     * @returns {Promise<{accounts: Array, skipped: number}>}
     */
    async getRawDataForExport() {
        if (!this.canEncrypt()) {
            throw new Error("Not authenticated");
        }

        const accounts = [];
        let skipped = 0;
        for (const account of await this.getAccounts()) {
            const copy = { ...account };
            if (account.encrypted) {
                try {
                    copy.secret = await this.cryptoManager.decrypt(account.secret);
                    copy.encrypted = false;
                } catch (error) {
                    skipped++;
                    continue;
                }
            }
            accounts.push(copy);
        }
        return { accounts, skipped };
    }

    /**
     * Import data from a backup file.
     * @param {Object} file - Parsed backup JSON
     * @param {string|null} importPassword - Password for encrypted backups
     * @param {"replace"|"merge"} mode - Replace everything, or add/overwrite by id
     * @returns {Promise<{accounts: number, folders: number, skipped: number}>}
     * @throws {Error} With a user-facing message
     */
    async importData(file, importPassword = null, mode = "replace") {
        if (!this.canEncrypt()) {
            throw new Error("Unlock Twin Key before importing");
        }
        if (!file || typeof file !== "object" || Array.isArray(file)) {
            throw new Error("Invalid backup file format");
        }

        let payload = file;
        if (file.encrypted) {
            if (typeof file.encryptedData !== "string") {
                throw new Error("Invalid backup file format");
            }
            if (!importPassword) {
                throw new Error("Password required for encrypted import");
            }
            payload = await this.decryptImportData(file, importPassword);
        }

        const clean = StorageManager.validateImport(payload);

        const importedAccounts = [];
        for (const account of clean.accounts) {
            importedAccounts.push({
                ...account,
                secret: await this.cryptoManager.encrypt(account.secret),
                encrypted: true
            });
        }

        let accounts = importedAccounts;
        let folders = clean.folders;
        if (mode === "merge") {
            accounts = StorageManager.mergeById(await this.getAccounts(), importedAccounts);
            folders = StorageManager.mergeById(await this.getFolders(), clean.folders);
        }

        if (!folders.some(folder => folder.id === "uncategorized")) {
            folders.unshift({ id: "uncategorized", name: "Uncategorized", icon: "bi-folder", parentId: null, createdAt: new Date().toISOString() });
        }
        const folderIds = new Set(folders.map(folder => folder.id));
        accounts.forEach(account => {
            if (!folderIds.has(account.folderId)) account.folderId = "uncategorized";
        });

        // Single write: accounts and folders change together or not at all
        const update = { [this.accountsKey]: accounts, [this.foldersKey]: folders };
        if (clean.settings && mode === "replace") {
            update[this.settingsKey] = { ...(await this.getSettings()), ...clean.settings };
        }
        await this.setMany(update);

        return { accounts: importedAccounts.length, folders: clean.folders.length, skipped: clean.skipped };
    }

    /**
     * Decrypt an encrypted backup without touching the vault's auth keys.
     * @param {Object} file - Backup file with encryptedData (and kdf for v1.2+)
     * @param {string} password - Export password
     * @returns {Promise<Object>} Decrypted payload
     */
    async decryptImportData(file, password) {
        const candidates = [];

        if (file.kdf) {
            const kdf = file.kdf;
            const validKdf = kdf.name === "PBKDF2" && kdf.hash === "SHA-256" &&
                Number.isInteger(kdf.iterations) && kdf.iterations >= 1 && kdf.iterations <= 5000000 &&
                typeof kdf.salt === "string";
            if (!validKdf) {
                throw new Error("Unsupported backup encryption parameters");
            }
            candidates.push({ salt: CryptoManager.base64ToBytes(kdf.salt), iterations: kdf.iterations });
        } else {
            // v1.1 backups did not store their salt. The old export code wrote that salt
            // into twinkey_salt (bug), so the current or an archived vault salt can open it.
            for (const salt of await this.getLegacySaltCandidates()) {
                candidates.push({ salt, iterations: CryptoManager.LEGACY_ITERATIONS });
            }
        }

        for (const { salt, iterations } of candidates) {
            try {
                const key = await this.cryptoManager.deriveKey(password, salt, iterations);
                return JSON.parse(await this.cryptoManager.decryptWithKey(key, file.encryptedData));
            } catch (error) {
                // Wrong password or wrong salt: try the next candidate
            }
        }
        throw new Error("Invalid password or corrupted backup file");
    }

    /**
     * Salts that may open a v1.1 backup: the current vault salt plus archived ones.
     * @returns {Promise<Uint8Array[]>}
     */
    async getLegacySaltCandidates() {
        const salts = [];
        const current = await this.cryptoManager.getStoredSalt();
        if (current) salts.push(current);

        const archive = this.isExtension
            ? (await chrome.storage.local.get("twinkey_salt_archive")).twinkey_salt_archive
            : JSON.parse(localStorage.getItem("twinkey_salt_archive") || "[]");
        (Array.isArray(archive) ? archive : []).forEach(saltStr => salts.push(CryptoManager.saltFromString(saltStr)));
        return salts;
    }

    /**
     * Validate and normalize a decrypted backup payload. Only whitelisted fields survive.
     * @param {Object} payload - {accounts, folders, settings}
     * @returns {{accounts: Array, folders: Array, settings: Object|null, skipped: number}}
     * @throws {Error} When the payload has no usable structure
     */
    static validateImport(payload) {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw new Error("Invalid backup file format");
        }
        const hasAccounts = Array.isArray(payload.accounts);
        const hasFolders = Array.isArray(payload.folders);
        if (!hasAccounts && !hasFolders) {
            throw new Error("Invalid backup file format: no accounts or folders found");
        }

        const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
        const dateOrNull = value => typeof value === "string" && !isNaN(Date.parse(value)) ? value : null;
        const validId = value => typeof value === "string" && StorageManager.ID_PATTERN.test(value);
        const now = new Date().toISOString();
        let skipped = 0;

        const folders = [];
        const folderIds = new Set();
        for (const folder of hasFolders ? payload.folders : []) {
            const name = folder && typeof folder === "object" ? text(folder.name, 100) : "";
            if (!name) { skipped++; continue; }
            let id = validId(folder.id) ? folder.id : StorageManager.newId();
            if (folderIds.has(id)) { skipped++; continue; }
            folderIds.add(id);
            folders.push({
                id: id,
                name: name,
                icon: StorageManager.FOLDER_ICONS.includes(folder.icon) ? folder.icon : "bi-folder",
                parentId: null,
                createdAt: dateOrNull(folder.createdAt) || now
            });
        }

        const accounts = [];
        const accountIds = new Set();
        for (const account of hasAccounts ? payload.accounts : []) {
            if (!account || typeof account !== "object") { skipped++; continue; }
            const name = text(account.name, 200);
            const secret = typeof account.secret === "string" ? account.secret.replace(/\s/g, "").toUpperCase() : "";
            // Secrets encrypted by another vault cannot be read: only Base32 plaintext is accepted
            if (!name || account.encrypted || !StorageManager.BASE32_PATTERN.test(secret)) { skipped++; continue; }
            let id = validId(account.id) ? account.id : StorageManager.newId();
            if (accountIds.has(id)) id = StorageManager.newId();
            accountIds.add(id);
            accounts.push({
                id: id,
                name: name,
                service: text(account.service, 100) || "Other",
                email: text(account.email, 254),
                secret: secret,
                folderId: validId(account.folderId) ? account.folderId : "uncategorized",
                sortOrder: Number.isFinite(account.sortOrder) ? account.sortOrder : accounts.length,
                createdAt: dateOrNull(account.createdAt) || now,
                updatedAt: now,
                lastUsed: dateOrNull(account.lastUsed)
            });
        }

        let settings = null;
        const source = payload.settings;
        if (source && typeof source === "object" && !Array.isArray(source)) {
            settings = {};
            if (["auto", "light", "dark"].includes(source.theme)) settings.theme = source.theme;
            if (typeof source.showEmails === "boolean") settings.showEmails = source.showEmails;
            if (!Object.keys(settings).length) settings = null;
        }

        return { accounts, folders, settings, skipped };
    }

    /**
     * Merge two lists by id: incoming items replace existing ones with the same id.
     */
    static mergeById(existing, incoming) {
        const merged = existing.map(item => ({ ...item }));
        for (const item of incoming) {
            const index = merged.findIndex(current => current.id === item.id);
            if (index === -1) {
                merged.push(item);
            } else {
                merged[index] = item;
            }
        }
        return merged;
    }

    /**
     * Write several keys in one storage call.
     * @param {Object} items - key → value
     */
    async setMany(items) {
        if (this.isExtension) {
            await chrome.storage.local.set(items);
        } else {
            Object.entries(items).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
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

StorageManager.EXPORT_VERSION = "1.2";
StorageManager.ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
StorageManager.BASE32_PATTERN = /^[A-Z2-7]{16,}=*$/;
StorageManager.FOLDER_ICONS = ["bi-folder", "bi-briefcase", "bi-house", "bi-shield-lock", "bi-code-slash", "bi-credit-card", "bi-people", "bi-cloud"];
