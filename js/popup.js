class PopupManager {
    constructor() {
        this.storageManager = new StorageManager();
        this.otpUpdater = null;
        this.accounts = [];
        this.filteredAccounts = [];
        
        this.init();
    }

    async init() {
        await this.loadAccounts();
        this.setupEventListeners();
        this.renderAccounts();
        this.startOTPUpdater();
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
        document.getElementById("searchInput").addEventListener("input", (e) => {
            this.handleSearch(e.target.value);
        });

        // Settings button
        document.getElementById("settingsBtn").addEventListener("click", () => {
            chrome.tabs.create({ url: "index.html" });
        });

        // Close details button
        document.getElementById("closeDetailsBtn").addEventListener("click", () => {
            this.hideAccountDetails();
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
            this.showToast("يرجى ملء جميع الحقول", "error");
            return;
        }

        // Validate secret key format (Base32)
        if (!/^[A-Z2-7]+$/.test(formData.secret) || formData.secret.length < 16) {
            this.showToast("المفتاح السري غير صحيح", "error");
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
                this.renderAccounts();
                this.hideAddForm();
                this.showToast("تم إضافة الحساب بنجاح", "success");
            } else {
                this.showToast("فشل في إضافة الحساب", "error");
            }
        } catch (error) {
            console.error("Error adding account:", error);
            this.showToast("حدث خطأ في إضافة الحساب", "error");
        }
    }

    handleSearch(query) {
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
        this.renderAccounts();
    }

    renderAccounts() {
        const container = document.getElementById("accountsContainer");
        const emptyState = document.getElementById("emptyState");

        if (this.filteredAccounts.length === 0) {
            if (this.accounts.length === 0) {
                emptyState.innerHTML = `
                    <i class="bi bi-inbox display-6"></i>
                    <p class="mt-2 mb-0">لا توجد حسابات</p>
                    <button type="button" class="btn btn-primary btn-sm mt-2" id="addFirstAccountBtn">
                        إضافة حساب
                    </button>
                `;
                document.getElementById("addFirstAccountBtn").addEventListener("click", () => {
                    this.showAddForm();
                });
            } else {
                emptyState.innerHTML = `
                    <i class="bi bi-search display-6"></i>
                    <p class="mt-2 mb-0">لا توجد نتائج للبحث</p>
                `;
            }
            emptyState.classList.remove("d-none");
            container.innerHTML = "";
        } else {
            emptyState.classList.add("d-none");
            container.innerHTML = this.filteredAccounts.map(account => this.renderAccountCard(account)).join("");
            
            // Add event listeners to account cards
            this.filteredAccounts.forEach(account => {
                const card = document.querySelector(`[data-account-id="${account.id}"]`);
                if (card) {
                    card.addEventListener("click", () => this.showAccountDetails(account));
                    
                    const copyBtn = card.querySelector(".copy-btn");
                    if (copyBtn) {
                        copyBtn.addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.copyOTP(account);
                        });
                    }
                }
            });
        }
    }

    renderAccountCard(account) {
        const otp = this.generateOTP(account.secret);
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

    generateOTP(secret) {
        try {
            return window.TOTPGenerator.generate(secret);
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

    updateOTPCodes() {
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
            otpElements.forEach((element, index) => {
                const accountCard = element.closest(".account-card");
                const accountId = accountCard.getAttribute("data-account-id");
                const account = this.accounts.find(acc => acc.id === accountId);
                
                if (account) {
                    const newOTP = this.generateOTP(account.secret);
                    element.textContent = this.formatOTP(newOTP);
                    element.setAttribute("data-otp", newOTP);
                }
            });
        }
    }

    async copyOTP(account) {
        const otp = this.generateOTP(account.secret);
        
        try {
            await navigator.clipboard.writeText(otp);
            this.showToast(`تم نسخ كود ${account.name}`, "success");
            
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
            this.showToast("فشل في نسخ الكود", "error");
        }
    }

    showAccountDetails(account) {
        const detailsContent = document.getElementById("detailsContent");
        const detailsTitle = document.getElementById("detailsTitle");
        
        detailsTitle.textContent = account.name;
        
        const otp = this.generateOTP(account.secret);
        const lastUsed = account.lastUsed 
            ? new Date(account.lastUsed).toLocaleDateString("ar-SA")
            : "لم يستخدم بعد";
        
        detailsContent.innerHTML = `
            <div class="mb-3">
                <strong>الخدمة:</strong> ${account.service}
            </div>
            <div class="mb-3">
                <strong>البريد الإلكتروني:</strong> ${account.email}
            </div>
            <div class="mb-3">
                <strong>آخر استخدام:</strong> ${lastUsed}
            </div>
            <div class="otp-section mb-3">
                <div class="otp-code">${this.formatOTP(otp)}</div>
                <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${otp}')">
                    <i class="bi bi-copy"></i> نسخ
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

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new PopupManager();
});