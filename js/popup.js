class PopupManager {
    constructor() {
        this.storageManager = new StorageManager();
        this.totpGenerator = null;
        this.otpUpdater = null;
        this.accounts = [];
        this.filteredAccounts = [];
        
        this.init();
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Wait for i18n to initialize
        if (window.i18n) {
            await window.i18n.init();
        }
        
        // Initialize TOTP generator
        this.totpGenerator = new TOTPGenerator();
        
        await this.loadAccounts();
        this.setupEventListeners();
        await this.renderAccounts();
        this.startOTPUpdater();
        this.setupLanguageSelector();
    }

    async loadAccounts() {
        try {
            this.accounts = await this.storageManager.getAccounts();
            this.filteredAccounts = [...this.accounts];
        } catch (error) {
            console.error("Error loading accounts:", error);
            this.showToast("حدث خطأ في تحميل الحسابات", "error");
        }
    }

    setupEventListeners() {
        // Add account button
        document.getElementById("addAccountBtn").addEventListener("click", () => {
            this.showAddForm();
        });

        document.getElementById("addFirstAccountBtn").addEventListener("click", () => {
            this.showAddForm();
        });

        // Close form buttons
        document.getElementById("closeFormBtn").addEventListener("click", () => {
            this.hideAddForm();
        });

        document.getElementById("cancelFormBtn").addEventListener("click", () => {
            this.hideAddForm();
        });

        // Account form submission
        document.getElementById("accountForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleAddAccount();
        });

        // Search functionality
        document.getElementById("searchInput").addEventListener("input", async (e) => {
            await this.handleSearch(e.target.value);
        });

        // Settings button - show settings in popup
        document.getElementById("settingsBtn").addEventListener("click", () => {
            this.showSettings();
        });

        // Close details button
        document.getElementById("closeDetailsBtn").addEventListener("click", () => {
            this.hideAccountDetails();
        });

        // Language change listener
        document.addEventListener('languageChanged', async () => {
            await this.renderAccounts(); // Re-render to apply translations
        });
    }

    showAddForm() {
        document.getElementById("addAccountForm").classList.remove("d-none");
        document.getElementById("accountName").focus();
    }

    hideAddForm() {
        document.getElementById("addAccountForm").classList.add("d-none");
        document.getElementById("accountForm").reset();
    }

    async handleAddAccount() {
        const formData = {
            name: document.getElementById("accountName").value.trim(),
            service: document.getElementById("serviceName").value,
            email: document.getElementById("accountEmail").value.trim(),
            secret: document.getElementById("secretKey").value.replace(/\s/g, "").toUpperCase()
        };

        // Validate form data
        if (!formData.name || !formData.service || !formData.email || !formData.secret) {
            this.showToast(window.i18n ? window.i18n.t('error_fill_fields') : 'Please fill all fields', "error");
            return;
        }

        // Validate secret key format (Base32)
        if (!/^[A-Z2-7]+$/.test(formData.secret) || formData.secret.length < 16) {
            this.showToast(window.i18n ? window.i18n.t('error_invalid_secret') : 'Invalid secret key', "error");
            return;
        }

        try {
            const account = {
                id: this.generateId(),
                ...formData,
                folderId: "uncategorized",
                createdAt: new Date().toISOString(),
                lastUsed: null
            };

            const success = await this.storageManager.addAccount(account);
            
            if (success) {
                this.accounts.push(account);
                this.filteredAccounts = [...this.accounts];
                await this.renderAccounts();
                this.hideAddForm();
                this.showToast(window.i18n ? window.i18n.t('success_account_added') : 'Account added successfully', "success");
            } else {
                this.showToast(window.i18n ? window.i18n.t('error_adding_account') : 'Failed to add account', "error");
            }
        } catch (error) {
            console.error("Error adding account:", error);
            this.showToast(window.i18n ? window.i18n.t('error_adding_account') : 'Error adding account', "error");
        }
    }

    async handleSearch(query) {
        if (!query.trim()) {
            this.filteredAccounts = [...this.accounts];
        } else {
            const searchTerm = query.toLowerCase().trim();
            this.filteredAccounts = this.accounts.filter(account => 
                account.name.toLowerCase().includes(searchTerm) ||
                account.service.toLowerCase().includes(searchTerm) ||
                account.email.toLowerCase().includes(searchTerm)
            );
        }
        await this.renderAccounts();
    }

    async renderAccounts() {
        const container = document.getElementById("accountsContainer");
        const emptyState = document.getElementById("emptyState");

        // Safety check
        if (!container) {
            console.error("accountsContainer not found");
            return;
        }

        if (this.filteredAccounts.length === 0) {
            if (this.accounts.length === 0) {
                const noAccountsText = window.i18n ? window.i18n.t('no_accounts') : 'No accounts';
                const addAccountText = window.i18n ? window.i18n.t('add_account') : 'Add Account';
                
                // Create or update empty state
                if (emptyState) {
                    emptyState.innerHTML = `
                        <i class="bi bi-inbox display-6"></i>
                        <p class="mt-2 mb-0">${noAccountsText}</p>
                        <button type="button" class="btn btn-primary btn-sm mt-2" id="addFirstAccountBtn">
                            ${addAccountText}
                        </button>
                    `;
                    emptyState.classList.remove("d-none");
                    
                    // Add event listener with timeout to ensure DOM is ready
                    setTimeout(() => {
                        const btn = document.getElementById("addFirstAccountBtn");
                        if (btn) {
                            btn.addEventListener("click", () => {
                                this.showAddForm();
                            });
                        }
                    }, 0);
                } else {
                    // Create empty state if it doesn't exist
                    container.innerHTML = `
                        <div class="text-center text-muted py-4" id="emptyState">
                            <i class="bi bi-inbox display-6"></i>
                            <p class="mt-2 mb-0">${noAccountsText}</p>
                            <button type="button" class="btn btn-primary btn-sm mt-2" id="addFirstAccountBtn">
                                ${addAccountText}
                            </button>
                        </div>
                    `;
                    
                    setTimeout(() => {
                        const btn = document.getElementById("addFirstAccountBtn");
                        if (btn) {
                            btn.addEventListener("click", () => {
                                this.showAddForm();
                            });
                        }
                    }, 0);
                }
            } else {
                const noResultsText = window.i18n ? window.i18n.t('no_search_results') : 'No search results';
                if (emptyState) {
                    emptyState.innerHTML = `
                        <i class="bi bi-search display-6"></i>
                        <p class="mt-2 mb-0">${noResultsText}</p>
                    `;
                    emptyState.classList.remove("d-none");
                } else {
                    container.innerHTML = `
                        <div class="text-center text-muted py-4" id="emptyState">
                            <i class="bi bi-search display-6"></i>
                            <p class="mt-2 mb-0">${noResultsText}</p>
                        </div>
                    `;
                }
            }
        } else {
            // Hide empty state and show accounts
            if (emptyState) {
                emptyState.classList.add("d-none");
            }
            
            // Clear container and add account cards
            const accountCards = await Promise.all(
                this.filteredAccounts.map(account => this.renderAccountCard(account))
            );
            container.innerHTML = accountCards.join("");
            
            // Add event listeners to account cards
            setTimeout(() => {
                this.filteredAccounts.forEach(account => {
                    const card = document.querySelector(`[data-account-id="${account.id}"]`);
                    if (card) {
                        card.addEventListener("click", async () => await this.showAccountDetails(account));
                        
                        const copyBtn = card.querySelector(".copy-btn");
                        if (copyBtn) {
                            copyBtn.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                await this.copyOTP(account);
                            });
                        }
                    }
                });
            }, 0);
        }
    }

    async renderAccountCard(account) {
        const otp = await this.generateOTP(account.secret);
        const timeLeft = this.getTimeLeft();
        const timerClass = timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : "";

        return `
            <div class="account-card fade-in" data-account-id="${account.id}">
                <div class="account-header">
                    <div class="account-service">${account.service}</div>
                    <button class="copy-btn" title="نسخ الكود">
                        <i class="bi bi-copy"></i>
                    </button>
                </div>
                <div class="account-name">${account.name}</div>
                <div class="account-email">${account.email}</div>
                <div class="otp-section">
                    <div class="otp-code" data-otp="${otp}">${this.formatOTP(otp)}</div>
                    <div class="otp-timer ${timerClass}">${timeLeft}</div>
                </div>
            </div>
        `;
    }

    async generateOTP(secret) {
        try {
            if (this.totpGenerator) {
                const result = this.totpGenerator.generate(secret);
                // Handle both sync and async results
                if (result instanceof Promise) {
                    return await result;
                } else {
                    return result;
                }
            } else if (window.TOTPGenerator) {
                // Fallback to static usage
                const generator = new window.TOTPGenerator();
                const result = generator.generate(secret);
                if (result instanceof Promise) {
                    return await result;
                } else {
                    return result;
                }
            } else {
                throw new Error("TOTP Generator not available");
            }
        } catch (error) {
            console.error("Error generating OTP:", error);
            return "------";
        }
    }

    formatOTP(otp) {
        if (otp === "------") return otp;
        return otp.replace(/(\d{3})(\d{3})/, "$1 $2");
    }

    getTimeLeft() {
        const now = Math.floor(Date.now() / 1000);
        return 30 - (now % 30);
    }

    startOTPUpdater() {
        if (this.otpUpdater) {
            clearInterval(this.otpUpdater);
        }

        this.otpUpdater = setInterval(() => {
            this.updateOTPCodes();
        }, 1000);
    }

    async updateOTPCodes() {
        const otpElements = document.querySelectorAll(".otp-code");
        const timerElements = document.querySelectorAll(".otp-timer");
        const timeLeft = this.getTimeLeft();

        // Update timers
        timerElements.forEach(timer => {
            timer.textContent = timeLeft;
            timer.className = `otp-timer ${timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : ""}`;
        });

        // Regenerate OTP codes when timer reaches 0
        if (timeLeft === 30) {
            const updates = Array.from(otpElements).map(async (element) => {
                const accountCard = element.closest(".account-card");
                const accountId = accountCard.getAttribute("data-account-id");
                const account = this.accounts.find(acc => acc.id === accountId);
                
                if (account) {
                    const newOTP = await this.generateOTP(account.secret);
                    element.textContent = this.formatOTP(newOTP);
                    element.setAttribute("data-otp", newOTP);
                }
            });
            
            await Promise.all(updates);
        }
    }

    async copyOTP(account) {
        const otp = await this.generateOTP(account.secret);
        
        try {
            await navigator.clipboard.writeText(otp);
            const successMsg = window.i18n ? window.i18n.t('success_account_copied', { name: account.name }) : `OTP code copied for ${account.name}`;
            this.showToast(successMsg, "success");
            
            // Update last used
            account.lastUsed = new Date().toISOString();
            await this.storageManager.updateAccount(account.id, { lastUsed: account.lastUsed });
            
            // Visual feedback
            const button = document.querySelector(`[data-account-id="${account.id}"] .copy-btn`);
            if (button) {
                button.classList.add("copy-success");
                setTimeout(() => button.classList.remove("copy-success"), 300);
            }
        } catch (error) {
            console.error("Error copying OTP:", error);
            this.showToast(window.i18n ? window.i18n.t('error_copying_code') : 'Failed to copy code', "error");
        }
    }

    async showAccountDetails(account) {
        const detailsContent = document.getElementById("detailsContent");
        const detailsTitle = document.getElementById("detailsTitle");
        
        detailsTitle.textContent = account.name;
        
        const otp = await this.generateOTP(account.secret);
        const lastUsed = account.lastUsed 
            ? (window.i18n ? window.i18n.formatDate(account.lastUsed) : new Date(account.lastUsed).toLocaleDateString())
            : (window.i18n ? window.i18n.t('never_used') : 'Never used');
        
        const serviceLabel = window.i18n ? window.i18n.t('service') : 'Service';
        const emailLabel = window.i18n ? window.i18n.t('email') : 'Email';
        const lastUsedLabel = window.i18n ? window.i18n.t('last_used') : 'Last Used';
        const copyText = window.i18n ? window.i18n.t('copy') : 'Copy';
        
        detailsContent.innerHTML = `
            <div class="mb-3">
                <strong>${serviceLabel}:</strong> ${account.service}
            </div>
            <div class="mb-3">
                <strong>${emailLabel}:</strong> ${account.email}
            </div>
            <div class="mb-3">
                <strong>${lastUsedLabel}:</strong> ${lastUsed}
            </div>
            <div class="otp-section mb-3">
                <div class="otp-code">${this.formatOTP(otp)}</div>
                <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${otp}')">
                    <i class="bi bi-copy"></i> ${copyText}
                </button>
            </div>
        `;
        
        document.getElementById("accountDetails").classList.remove("d-none");
    }

    hideAccountDetails() {
        document.getElementById("accountDetails").classList.add("d-none");
    }

    showToast(message, type = "info") {
        const toast = document.getElementById("toast");
        const toastMessage = document.getElementById("toastMessage");
        
        toastMessage.textContent = message;
        toast.className = `toast show ${type === "error" ? "bg-danger text-white" : type === "success" ? "bg-success text-white" : ""}`;
        
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    setupLanguageSelector() {
        // Add language selector to header if not exists
        const header = document.querySelector('.header .d-flex > div');
        const addAccountBtn = document.getElementById('addAccountBtn');
        
        if (header && addAccountBtn && !document.getElementById('languageSelector')) {
            const langBtn = document.createElement('button');
            langBtn.id = 'languageSelector';
            langBtn.className = 'btn btn-outline-light btn-sm me-1';
            langBtn.innerHTML = '<i class="bi bi-translate"></i>';
            langBtn.title = window.i18n ? window.i18n.t('language') : 'Language';
            
            langBtn.addEventListener('click', () => {
                this.toggleLanguage();
            });
            
            // Insert as first child instead of before addAccountBtn
            header.insertBefore(langBtn, header.firstChild);
        }
    }

    async toggleLanguage() {
        if (window.i18n) {
            const currentLang = window.i18n.getCurrentLanguage();
            const newLang = currentLang === 'ar' ? 'en' : 'ar';
            await window.i18n.setLanguage(newLang);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showSettings() {
        // Simple settings display - could be enhanced with modal
        alert("Settings feature will be added in future updates!");
    }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new PopupManager();
});