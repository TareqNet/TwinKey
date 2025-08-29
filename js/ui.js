// UI Controller for TwinKey Application

class UIController {
    constructor(storageManager, totpGenerator) {
        this.storage = storageManager;
        this.totp = totpGenerator;
        this.currentFolderId = "all";
        this.searchQuery = "";
        this.sortBy = "name";
        this.otpUpdateInterval = null;
        this.countdownInterval = null;
        
        this.initializeEventListeners();
        // Load data asynchronously
        this.loadInitialData().catch(error => {
            console.error("Failed to load initial data:", error);
        });
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Add Account Form
        document.getElementById("addAccountForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            await this.handleAddAccount();
        });

        // Add Folder Form
        document.getElementById("addFolderForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            await this.handleAddFolder();
        });

        // Search Input
        document.getElementById("searchInput").addEventListener("input", async (e) => {
            this.searchQuery = e.target.value;
            await this.renderAccounts();
        });

        // Sort Select
        document.getElementById("sortSelect").addEventListener("change", async (e) => {
            this.sortBy = e.target.value;
            await this.renderAccounts();
        });

        // Modal Reset Events
        document.getElementById("addAccountModal").addEventListener("hidden.bs.modal", () => {
            this.resetAccountForm();
        });

        document.getElementById("addFolderModal").addEventListener("hidden.bs.modal", () => {
            this.resetFolderForm();
        });
    }

    /**
     * Load initial data and render UI
     */
    async loadInitialData() {
        try {
            await this.renderFolders();
            await this.renderAccounts();
            await this.updateFolderOptions();
            this.startOTPUpdates();
            await this.updateLastModified();
        } catch (error) {
            console.error("Error loading initial data:", error);
        }
    }

    // ===============================
    // Account Management UI
    // ===============================

    /**
     * Handle add account form submission
     */
    async handleAddAccount() {
        const form = document.getElementById("addAccountForm");
        const formData = new FormData(form);
        
        const account = {
            name: document.getElementById("accountName").value.trim(),
            service: document.getElementById("serviceName").value,
            email: document.getElementById("accountEmail").value.trim(),
            secret: document.getElementById("secretKey").value.trim().replace(/\s+/g, "").toUpperCase(),
            folderId: document.getElementById("folderSelect").value
        };

        // Validate inputs
        if (!this.validateAccountData(account)) {
            return;
        }

        // Validate secret key
        if (!this.totp.validateSecret(account.secret)) {
            this.showToast("Invalid secret key. Must be at least 16 characters of Base32", "error");
            return;
        }

        // Add account
        const accountId = await this.storage.addAccount(account);
        if (accountId) {
            this.showToast("Account added successfully", "success");
            this.resetAccountForm();
            bootstrap.Modal.getInstance(document.getElementById("addAccountModal")).hide();
            await this.renderAccounts();
            await this.renderFolders(); // Update counts
        } else {
            this.showToast("Error adding account", "error");
        }
    }

    /**
     * Validate account data
     * @param {Object} account - Account data
     * @returns {boolean} Validation result
     */
    validateAccountData(account) {
        if (!account.name) {
            this.showToast("Please enter account name", "error");
            return false;
        }

        if (!account.service) {
            this.showToast("Please select service type", "error");
            return false;
        }

        if (!account.email) {
            this.showToast("Please enter email address", "error");
            return false;
        }

        if (!account.secret) {
            this.showToast("Please enter secret key", "error");
            return false;
        }

        // Check for duplicate accounts
        const existingAccounts = await this.storage.getAccounts();
        const isDuplicate = existingAccounts.some(acc => 
            acc.email === account.email && acc.service === account.service
        );

        if (isDuplicate) {
            this.showToast("An account with the same email and service already exists", "error");
            return false;
        }

        return true;
    }

    /**
     * Reset add account form
     */
    resetAccountForm() {
        document.getElementById("addAccountForm").reset();
    }

    /**
     * Handle account deletion
     * @param {string} accountId - Account ID
     */
    async handleDeleteAccount(accountId) {
        const account = await this.storage.getAccount(accountId);
        if (!account) return;

        if (confirm(`Are you sure you want to delete account ${account.name}?`)) {
            if (await this.storage.deleteAccount(accountId)) {
                this.showToast("Account deleted successfully", "success");
                await this.renderAccounts();
                await this.renderFolders();
                bootstrap.Modal.getInstance(document.getElementById("accountDetailsModal"))?.hide();
            } else {
                this.showToast("Error deleting account", "error");
            }
        }
    }

    /**
     * Show account details modal
     * @param {string} accountId - Account ID
     */
    async showAccountDetails(accountId) {
        const account = await this.storage.getAccount(accountId);
        if (!account) return;

        document.getElementById("accountDetailsTitle").textContent = account.name;
        document.getElementById("accountDetailsBody").innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <strong>Service Type:</strong><br>
                    <span class="badge bg-primary">${account.service}</span>
                </div>
                <div class="col-md-6">
                    <strong>Email Address:</strong><br>
                    ${account.email}
                </div>
            </div>
            <hr>
            <div class="row">
                <div class="col-md-6">
                    <strong>Created Date:</strong><br>
                    ${new Date(account.createdAt).toLocaleDateString("ar")}
                </div>
                <div class="col-md-6">
                    <strong>Folder:</strong><br>
                    ${this.getFolderName(account.folderId)}
                </div>
            </div>
        `;

        // Set up buttons
        document.getElementById("deleteAccountBtn").onclick = () => {
            this.handleDeleteAccount(accountId);
        };

        document.getElementById("editAccountBtn").onclick = () => {
            // TODO: Implement edit functionality
            this.showToast("Edit feature is under development", "info");
        };

        new bootstrap.Modal(document.getElementById("accountDetailsModal")).show();
    }

    // ===============================
    // Folder Management UI
    // ===============================

    /**
     * Handle add folder form submission
     */
    async handleAddFolder() {
        const folderName = document.getElementById("folderName").value.trim();
        
        if (!folderName) {
            this.showToast("Please enter folder name", "error");
            return;
        }

        // Check for duplicate folder names
        const existingFolders = await this.storage.getFolders();
        const isDuplicate = existingFolders.some(folder => 
            folder.name.toLowerCase() === folderName.toLowerCase()
        );

        if (isDuplicate) {
            this.showToast("A folder with the same name already exists", "error");
            return;
        }

        const folderId = await this.storage.addFolder({ name: folderName });
        if (folderId) {
            this.showToast("Folder added successfully", "success");
            this.resetFolderForm();
            bootstrap.Modal.getInstance(document.getElementById("addFolderModal")).hide();
            await this.renderFolders();
            await this.updateFolderOptions();
        } else {
            this.showToast("Error adding folder", "error");
        }
    }

    /**
     * Reset add folder form
     */
    resetFolderForm() {
        document.getElementById("addFolderForm").reset();
    }

    /**
     * Handle folder selection
     * @param {string} folderId - Folder ID
     */
    handleFolderSelect(folderId) {
        this.currentFolderId = folderId;
        
        // Update active folder in UI
        document.querySelectorAll("[data-folder-id]").forEach(btn => {
            btn.classList.remove("active");
        });
        document.querySelector(`[data-folder-id="${folderId}"]`)?.classList.add("active");
        
        // Update folder name display
        document.getElementById("currentFolderName").textContent = this.getFolderDisplayName(folderId);
        
        // Re-render accounts for selected folder
        await this.renderAccounts();
    }

    /**
     * Get folder display name
     * @param {string} folderId - Folder ID
     * @returns {string} Display name
     */
    getFolderDisplayName(folderId) {
        if (folderId === "all") return "All Accounts";
        if (folderId === "uncategorized") return "Uncategorized";
        
        const folder = this.storage.getFolder(folderId);
        return folder ? folder.name : "Unknown";
    }

    /**
     * Get folder name for account details
     * @param {string} folderId - Folder ID
     * @returns {string} Folder name
     */
    getFolderName(folderId) {
        return this.getFolderDisplayName(folderId);
    }

    // ===============================
    // Rendering Methods
    // ===============================

    /**
     * Render folders in sidebar
     */
    async renderFolders() {
        const container = document.getElementById("foldersContainer").querySelector(".list-group");
        const folders = await this.storage.getFolders();
        const accounts = await this.storage.getAccounts();
        
        // Count accounts per folder
        const folderCounts = {};
        folderCounts["all"] = accounts.length;
        folderCounts["uncategorized"] = accounts.filter(acc => acc.folderId === "uncategorized").length;
        
        folders.forEach(folder => {
            if (folder.id !== "uncategorized") {
                folderCounts[folder.id] = accounts.filter(acc => acc.folderId === folder.id).length;
            }
        });

        // Update default folder counts
        document.getElementById("allAccountsCount").textContent = folderCounts["all"];
        document.getElementById("uncategorizedCount").textContent = folderCounts["uncategorized"];

        // Render custom folders
        const customFolders = folders.filter(folder => folder.id !== "uncategorized");
        const customFoldersHtml = customFolders.map(folder => `
            <button type="button" class="list-group-item list-group-item-action" 
                    data-folder-id="${folder.id}" 
                    onclick="app.ui.handleFolderSelect('${folder.id}')">
                <i class="bi bi-folder"></i>
                ${folder.name}
                <span class="badge bg-secondary rounded-pill">${folderCounts[folder.id] || 0}</span>
            </button>
        `).join("");

        // Add custom folders after default ones
        const defaultFolders = container.querySelectorAll(".list-group-item");
        defaultFolders.forEach(folder => {
            folder.onclick = () => this.handleFolderSelect(folder.dataset.folderId);
        });

        if (customFoldersHtml) {
            container.insertAdjacentHTML("beforeend", customFoldersHtml);
        }
    }

    /**
     * Render accounts based on current filter and search
     */
    async renderAccounts() {
        const container = document.getElementById("accountsContainer");
        const emptyState = document.getElementById("emptyState");
        
        try {
            // Get accounts for current folder
            let accounts = await this.storage.getAccountsByFolder(this.currentFolderId);
            
            // Apply search filter
            if (this.searchQuery) {
                accounts = await this.storage.searchAccounts(this.searchQuery);
                if (this.currentFolderId !== "all") {
                    accounts = accounts.filter(acc => acc.folderId === this.currentFolderId);
                }
            }
            
            // Sort accounts
            accounts = await this.storage.sortAccounts(accounts, this.sortBy);
            
            if (accounts.length === 0) {
                emptyState.style.display = "block";
                container.querySelectorAll(".account-card").forEach(card => card.remove());
                return;
            }
            
            emptyState.style.display = "none";
            
            // Clear existing account cards
            container.querySelectorAll(".account-card").forEach(card => card.remove());
            
            // Render each account
            for (const account of accounts) {
                const accountCard = await this.createAccountCard(account);
                container.appendChild(accountCard);
            }
            
        } catch (error) {
            console.error("Error rendering accounts:", error);
            // Show empty state on error
            emptyState.style.display = "block";
            container.querySelectorAll(".account-card").forEach(card => card.remove());
        }
    }

    /**
     * Create account card element
     * @param {Object} account - Account data
     * @returns {HTMLElement} Account card element
     */
    async createAccountCard(account) {
        const card = document.createElement("div");
        card.className = "card account-card fade-in";
        card.onclick = async () => await this.showAccountDetails(account.id);
        
        const otpCode = await this.totp.generate(account.secret);
        const remainingSeconds = this.totp.getRemainingSeconds();
        const progress = this.totp.getProgress();
        
        card.innerHTML = `
            <div class="account-header">
                <div class="account-info">
                    <h5>${account.name}</h5>
                    <small class="text-muted">
                        <i class="bi bi-envelope"></i> ${account.email}
                    </small>
                </div>
                <span class="service-badge badge bg-primary">${account.service}</span>
            </div>
            <div class="otp-display">
                <div class="otp-code" data-account-id="${account.id}">${otpCode}</div>
                <div class="otp-timer">
                    <small>Expires in ${remainingSeconds} seconds</small>
                    <svg class="progress-ring" width="40" height="40">
                        <circle class="progress-ring-circle" cx="20" cy="20" r="16"></circle>
                        <circle class="progress-ring-progress" cx="20" cy="20" r="16" 
                                style="stroke-dasharray: 100.53; stroke-dashoffset: ${100.53 - (progress * 100.53 / 100)};"></circle>
                    </svg>
                </div>
                <button type="button" class="btn copy-btn btn-sm mt-2" 
                        onclick="event.stopPropagation(); app.ui.copyToClipboard('${otpCode}', this)">
                    <i class="bi bi-copy"></i> Copy
                </button>
            </div>
        `;
        
        return card;
    }

    /**
     * Update folder options in forms
     */
    async updateFolderOptions() {
        const select = document.getElementById("folderSelect");
        const folders = await this.storage.getFolders();
        
        // Clear existing options except default
        const defaultOption = select.querySelector('option[value="uncategorized"]');
        select.innerHTML = "";
        select.appendChild(defaultOption);
        
        // Add custom folders
        folders.forEach(folder => {
            if (folder.id !== "uncategorized") {
                const option = document.createElement("option");
                option.value = folder.id;
                option.textContent = folder.name;
                select.appendChild(option);
            }
        });
    }

    // ===============================
    // OTP Updates and Timers
    // ===============================

    /**
     * Start automatic OTP updates
     */
    startOTPUpdates() {
        // Update OTP codes every second
        this.otpUpdateInterval = setInterval(() => {
            this.updateOTPCodes();
            this.updateCountdownTimers();
        }, 1000);
    }

    /**
     * Update all visible OTP codes
     */
    updateOTPCodes() {
        document.querySelectorAll(".otp-code[data-account-id]").forEach(codeElement => {
            const accountId = codeElement.dataset.accountId;
            const account = await this.storage.getAccount(accountId);
            
            if (account) {
                const newCode = this.totp.generate(account.secret);
                if (codeElement.textContent !== newCode) {
                    codeElement.textContent = newCode;
                    codeElement.classList.add("pulse");
                    setTimeout(() => codeElement.classList.remove("pulse"), 600);
                }
            }
        });
    }

    /**
     * Update countdown timers
     */
    updateCountdownTimers() {
        const remainingSeconds = this.totp.getRemainingSeconds();
        const progress = this.totp.getProgress();
        const circumference = 100.53;
        const offset = circumference - (progress * circumference / 100);
        
        // Update timer text
        document.querySelectorAll(".otp-timer small").forEach(timer => {
            timer.textContent = `Expires in ${remainingSeconds} seconds`;
        });
        
        // Update progress rings
        document.querySelectorAll(".progress-ring-progress").forEach(ring => {
            ring.style.strokeDashoffset = offset;
        });
    }

    /**
     * Update last modified time
     */
    async updateLastModified() {
        const lastUpdate = document.getElementById("lastUpdate");
        const stats = await this.storage.getStorageStats();
        
        if (stats.lastModified) {
            const date = new Date(stats.lastModified);
            const now = new Date();
            const diffMinutes = Math.floor((now - date) / (1000 * 60));
            
            if (diffMinutes < 1) {
                lastUpdate.textContent = "Now";
            } else if (diffMinutes < 60) {
                lastUpdate.textContent = `${diffMinutes} minutes ago`;
            } else {
                lastUpdate.textContent = date.toLocaleString("en");
            }
        } else {
            lastUpdate.textContent = "Not updated";
        }
    }

    // ===============================
    // Utility Methods
    // ===============================

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button that triggered copy
     */
    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check"></i> Copied';
            button.classList.add("btn-success");
            button.classList.remove("copy-btn");
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove("btn-success");
                button.classList.add("copy-btn");
            }, 2000);
            
            this.showToast("Code copied successfully", "success");
        } catch (error) {
            console.error("Failed to copy:", error);
            this.showToast("Failed to copy code", "error");
        }
    }

    /**
     * Show toast notification
     * @param {string} message - Message to show
     * @param {string} type - Toast type (success, error, info, warning)
     */
    showToast(message, type = "info") {
        // Create toast container if doesn't exist
        let toastContainer = document.querySelector(".toast-container");
        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.className = "toast-container";
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement("div");
        toast.className = `toast align-items-center text-bg-${type === "error" ? "danger" : type} border-0`;
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast"></button>
            </div>
        `;

        toastContainer.appendChild(toast);
        
        // Show toast
        const bootstrapToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        bootstrapToast.show();
        
        // Remove toast element after it's hidden
        toast.addEventListener("hidden.bs.toast", () => {
            toast.remove();
        });
    }

    /**
     * Cleanup intervals on page unload
     */
    cleanup() {
        if (this.otpUpdateInterval) {
            clearInterval(this.otpUpdateInterval);
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }
}