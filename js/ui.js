// UI Controller for OTP Manager Application

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
        this.loadInitialData();
    }

    /**
     * Initialize all event listeners
     */
    initializeEventListeners() {
        // Add Account Form
        document.getElementById("addAccountForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleAddAccount();
        });

        // Add Folder Form
        document.getElementById("addFolderForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleAddFolder();
        });

        // Search Input
        document.getElementById("searchInput").addEventListener("input", (e) => {
            this.searchQuery = e.target.value;
            this.renderAccounts();
        });

        // Sort Select
        document.getElementById("sortSelect").addEventListener("change", (e) => {
            this.sortBy = e.target.value;
            this.renderAccounts();
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
    loadInitialData() {
        this.renderFolders();
        this.renderAccounts();
        this.updateFolderOptions();
        this.startOTPUpdates();
        this.updateLastModified();
    }

    // ===============================
    // Account Management UI
    // ===============================

    /**
     * Handle add account form submission
     */
    handleAddAccount() {
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
            this.showToast("المفتاح السري غير صالح. يجب أن يكون 16 حرف على الأقل من Base32", "error");
            return;
        }

        // Add account
        const accountId = this.storage.addAccount(account);
        if (accountId) {
            this.showToast("تم إضافة الحساب بنجاح", "success");
            this.resetAccountForm();
            bootstrap.Modal.getInstance(document.getElementById("addAccountModal")).hide();
            this.renderAccounts();
            this.renderFolders(); // Update counts
        } else {
            this.showToast("خطأ في إضافة الحساب", "error");
        }
    }

    /**
     * Validate account data
     * @param {Object} account - Account data
     * @returns {boolean} Validation result
     */
    validateAccountData(account) {
        if (!account.name) {
            this.showToast("يرجى إدخال اسم الحساب", "error");
            return false;
        }

        if (!account.service) {
            this.showToast("يرجى اختيار نوع الخدمة", "error");
            return false;
        }

        if (!account.email) {
            this.showToast("يرجى إدخال البريد الإلكتروني", "error");
            return false;
        }

        if (!account.secret) {
            this.showToast("يرجى إدخال المفتاح السري", "error");
            return false;
        }

        // Check for duplicate accounts
        const existingAccounts = this.storage.getAccounts();
        const isDuplicate = existingAccounts.some(acc => 
            acc.email === account.email && acc.service === account.service
        );

        if (isDuplicate) {
            this.showToast("يوجد حساب بنفس البريد الإلكتروني والخدمة", "error");
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
    handleDeleteAccount(accountId) {
        const account = this.storage.getAccount(accountId);
        if (!account) return;

        if (confirm(`هل أنت متأكد من حذف حساب ${account.name}؟`)) {
            if (this.storage.deleteAccount(accountId)) {
                this.showToast("تم حذف الحساب بنجاح", "success");
                this.renderAccounts();
                this.renderFolders();
                bootstrap.Modal.getInstance(document.getElementById("accountDetailsModal"))?.hide();
            } else {
                this.showToast("خطأ في حذف الحساب", "error");
            }
        }
    }

    /**
     * Show account details modal
     * @param {string} accountId - Account ID
     */
    showAccountDetails(accountId) {
        const account = this.storage.getAccount(accountId);
        if (!account) return;

        document.getElementById("accountDetailsTitle").textContent = account.name;
        document.getElementById("accountDetailsBody").innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <strong>نوع الخدمة:</strong><br>
                    <span class="badge bg-primary">${account.service}</span>
                </div>
                <div class="col-md-6">
                    <strong>البريد الإلكتروني:</strong><br>
                    ${account.email}
                </div>
            </div>
            <hr>
            <div class="row">
                <div class="col-md-6">
                    <strong>تاريخ الإنشاء:</strong><br>
                    ${new Date(account.createdAt).toLocaleDateString("ar")}
                </div>
                <div class="col-md-6">
                    <strong>المجلد:</strong><br>
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
            this.showToast("ميزة التعديل قيد التطوير", "info");
        };

        new bootstrap.Modal(document.getElementById("accountDetailsModal")).show();
    }

    // ===============================
    // Folder Management UI
    // ===============================

    /**
     * Handle add folder form submission
     */
    handleAddFolder() {
        const folderName = document.getElementById("folderName").value.trim();
        
        if (!folderName) {
            this.showToast("يرجى إدخال اسم المجلد", "error");
            return;
        }

        // Check for duplicate folder names
        const existingFolders = this.storage.getFolders();
        const isDuplicate = existingFolders.some(folder => 
            folder.name.toLowerCase() === folderName.toLowerCase()
        );

        if (isDuplicate) {
            this.showToast("يوجد مجلد بنفس الاسم", "error");
            return;
        }

        const folderId = this.storage.addFolder({ name: folderName });
        if (folderId) {
            this.showToast("تم إضافة المجلد بنجاح", "success");
            this.resetFolderForm();
            bootstrap.Modal.getInstance(document.getElementById("addFolderModal")).hide();
            this.renderFolders();
            this.updateFolderOptions();
        } else {
            this.showToast("خطأ في إضافة المجلد", "error");
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
        this.renderAccounts();
    }

    /**
     * Get folder display name
     * @param {string} folderId - Folder ID
     * @returns {string} Display name
     */
    getFolderDisplayName(folderId) {
        if (folderId === "all") return "جميع الحسابات";
        if (folderId === "uncategorized") return "غير مصنف";
        
        const folder = this.storage.getFolder(folderId);
        return folder ? folder.name : "غير معروف";
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
    renderFolders() {
        const container = document.getElementById("foldersContainer").querySelector(".list-group");
        const folders = this.storage.getFolders();
        const accounts = this.storage.getAccounts();
        
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
    renderAccounts() {
        const container = document.getElementById("accountsContainer");
        const emptyState = document.getElementById("emptyState");
        
        // Get accounts for current folder
        let accounts = this.storage.getAccountsByFolder(this.currentFolderId);
        
        // Apply search filter
        if (this.searchQuery) {
            accounts = this.storage.searchAccounts(this.searchQuery);
            if (this.currentFolderId !== "all") {
                accounts = accounts.filter(acc => acc.folderId === this.currentFolderId);
            }
        }
        
        // Sort accounts
        accounts = this.storage.sortAccounts(accounts, this.sortBy);
        
        if (accounts.length === 0) {
            emptyState.style.display = "block";
            container.querySelectorAll(".account-card").forEach(card => card.remove());
            return;
        }
        
        emptyState.style.display = "none";
        
        // Clear existing account cards
        container.querySelectorAll(".account-card").forEach(card => card.remove());
        
        // Render each account
        accounts.forEach(account => {
            const accountCard = this.createAccountCard(account);
            container.appendChild(accountCard);
        });
    }

    /**
     * Create account card element
     * @param {Object} account - Account data
     * @returns {HTMLElement} Account card element
     */
    createAccountCard(account) {
        const card = document.createElement("div");
        card.className = "card account-card fade-in";
        card.onclick = () => this.showAccountDetails(account.id);
        
        const otpCode = this.totp.generate(account.secret);
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
                    <small>ينتهي في ${remainingSeconds} ثانية</small>
                    <svg class="progress-ring" width="40" height="40">
                        <circle class="progress-ring-circle" cx="20" cy="20" r="16"></circle>
                        <circle class="progress-ring-progress" cx="20" cy="20" r="16" 
                                style="stroke-dasharray: 100.53; stroke-dashoffset: ${100.53 - (progress * 100.53 / 100)};"></circle>
                    </svg>
                </div>
                <button type="button" class="btn copy-btn btn-sm mt-2" 
                        onclick="event.stopPropagation(); app.ui.copyToClipboard('${otpCode}', this)">
                    <i class="bi bi-copy"></i> نسخ
                </button>
            </div>
        `;
        
        return card;
    }

    /**
     * Update folder options in forms
     */
    updateFolderOptions() {
        const select = document.getElementById("folderSelect");
        const folders = this.storage.getFolders();
        
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
            const account = this.storage.getAccount(accountId);
            
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
            timer.textContent = `ينتهي في ${remainingSeconds} ثانية`;
        });
        
        // Update progress rings
        document.querySelectorAll(".progress-ring-progress").forEach(ring => {
            ring.style.strokeDashoffset = offset;
        });
    }

    /**
     * Update last modified time
     */
    updateLastModified() {
        const lastUpdate = document.getElementById("lastUpdate");
        const stats = this.storage.getStorageStats();
        
        if (stats.lastModified) {
            const date = new Date(stats.lastModified);
            const now = new Date();
            const diffMinutes = Math.floor((now - date) / (1000 * 60));
            
            if (diffMinutes < 1) {
                lastUpdate.textContent = "الآن";
            } else if (diffMinutes < 60) {
                lastUpdate.textContent = `منذ ${diffMinutes} دقيقة`;
            } else {
                lastUpdate.textContent = date.toLocaleString("ar");
            }
        } else {
            lastUpdate.textContent = "لم يتم التحديث";
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
            button.innerHTML = '<i class="bi bi-check"></i> تم النسخ';
            button.classList.add("btn-success");
            button.classList.remove("copy-btn");
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove("btn-success");
                button.classList.add("copy-btn");
            }, 2000);
            
            this.showToast("تم نسخ الرمز بنجاح", "success");
        } catch (error) {
            console.error("Failed to copy:", error);
            this.showToast("فشل في نسخ الرمز", "error");
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