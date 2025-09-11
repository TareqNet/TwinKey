class PopupManager {
    constructor() {
        this.storageManager = new StorageManager();
        this.cryptoManager = new CryptoManager();
        this.totpGenerator = null;
        this.otpUpdater = null;
        this.accounts = [];
        this.filteredAccounts = [];
        this.folders = [];
        this.currentFolderId = 'all';
        this.sortBy = 'custom';
        this.draggedElement = null;
        this.containerDragSetup = false;
        this.dropZonesVisible = false;
        this.isAuthenticated = false;
        this.pendingAccount = null;
        
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
        
        // Initialize crypto manager
        await this.storageManager.initializeCrypto(this.cryptoManager);
        
        // Enable encryption by default for new accounts
        this.storageManager.isEncryptionEnabled = true;
        
        // Check if authentication is required
        const needsAuth = await this.checkAuthenticationRequired();
        if (needsAuth) {
            this.showAuthenticationModal();
        } else {
            await this.loadData();
            this.setupEventListeners();
            await this.renderFolders();
            await this.renderAccounts();
            this.startOTPUpdater();
            this.setupLanguageSelector();
        }
    }

    async loadData() {
        try {
            this.accounts = await this.storageManager.getAccounts();
            this.folders = await this.storageManager.getFolders() || [];
            
            // Initialize sortOrder for accounts that don't have it
            let hasChanges = false;
            this.accounts.forEach((account, index) => {
                if (account.sortOrder === undefined) {
                    account.sortOrder = index;
                    hasChanges = true;
                }
            });
            
            // Save if we made changes
            if (hasChanges) {
                for (const account of this.accounts) {
                    if (account.sortOrder !== undefined) {
                        await this.storageManager.updateAccount(account.id, { sortOrder: account.sortOrder });
                    }
                }
            }
            
            this.filterAndSortAccounts();
        } catch (error) {
            console.error("Error loading data:", error);
            this.showToast("Error loading data", "error");
        }
    }

    filterAndSortAccounts() {
        // Filter by folder
        let filtered = this.currentFolderId === 'all' 
            ? [...this.accounts]
            : this.accounts.filter(account => account.folderId === this.currentFolderId);

        // Sort accounts
        switch (this.sortBy) {
            case 'name':
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'service':
                filtered.sort((a, b) => a.service.localeCompare(b.service));
                break;
            case 'created':
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'lastUsed':
                filtered.sort((a, b) => {
                    if (!a.lastUsed) return 1;
                    if (!b.lastUsed) return -1;
                    return new Date(b.lastUsed) - new Date(a.lastUsed);
                });
                break;
            case 'custom':
            default:
                // Sort by custom sortOrder if available, otherwise keep original order
                filtered.sort((a, b) => {
                    const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
                    const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
                    return orderA - orderB;
                });
                break;
        }

        this.filteredAccounts = filtered;
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

        // Edit form event listeners
        document.getElementById("closeEditFormBtn").addEventListener("click", () => {
            this.hideEditForm();
        });

        document.getElementById("cancelEditFormBtn").addEventListener("click", () => {
            this.hideEditForm();
        });

        document.getElementById("editAccountFormEl").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleEditAccount();
        });

        // Folder form event listeners
        document.getElementById("addFolderBtn").addEventListener("click", () => {
            this.showAddFolderForm();
        });

        document.getElementById("closeFolderFormBtn").addEventListener("click", () => {
            this.hideAddFolderForm();
        });

        document.getElementById("cancelFolderFormBtn").addEventListener("click", () => {
            this.hideAddFolderForm();
        });

        document.getElementById("folderForm").addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleAddFolder();
        });

        // Sort functionality
        document.getElementById("sortSelect").addEventListener("change", (e) => {
            this.sortBy = e.target.value;
            this.filterAndSortAccounts();
            this.renderAccounts();
        });

        // Search functionality
        document.getElementById("searchInput").addEventListener("input", (e) => {
            this.handleSearch(e.target.value);
        });


        // Close details button
        document.getElementById("closeDetailsBtn").addEventListener("click", () => {
            this.hideAccountDetails();
        });

        // Open in tab button
        document.getElementById("openInTabBtn").addEventListener("click", () => {
            this.openInNewTab();
        });

        // Settings button
        document.getElementById("settingsBtn").addEventListener("click", () => {
            this.showSettingsModal();
        });


        // Language change listener
        document.addEventListener('languageChanged', async () => {
            await this.renderAccounts(); // Re-render to apply translations
        });

        // Settings functionality - Export button now opens modal
        const exportBtn = document.getElementById("exportBtn");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                this.showExportOptionsModal();
            });
        }

        // Export options modal listeners
        const confirmExportBtn = document.getElementById("confirmExportBtn");
        if (confirmExportBtn) {
            confirmExportBtn.addEventListener("click", () => {
                this.handleExport();
            });
        }

        // Export type radio change listener
        const exportTypeRadios = document.querySelectorAll('input[name="exportType"]');
        exportTypeRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.toggleExportPasswordSection(e.target.value === 'encrypted');
            });
        });

        const importFile = document.getElementById("importFile");
        const importBtn = document.getElementById("importBtn");
        if (importFile && importBtn) {
            importFile.addEventListener("change", (e) => {
                this.handleFileSelection(e);
            });

            importBtn.addEventListener("click", () => {
                this.importData();
            });
        }

        // Settings modal close buttons
        const settingsModal = document.getElementById("settingsModal");
        if (settingsModal) {
            // Close button
            const closeBtn = settingsModal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
            if (closeBtn) {
                closeBtn.addEventListener("click", () => {
                    this.hideSettingsModal();
                });
            }

            // Click outside to close
            settingsModal.addEventListener("click", (e) => {
                if (e.target === settingsModal) {
                    this.hideSettingsModal();
                }
            });
        }
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
            folderId: document.getElementById("accountFolder").value,
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
                createdAt: new Date().toISOString(),
                lastUsed: null
            };

            const success = await this.storageManager.addAccount(account);
            
            if (success) {
                this.accounts.push(account);
                this.filterAndSortAccounts();
                await this.renderFolders();
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
            
            // Setup container drag and drop once
            if (!this.containerDragSetup) {
                this.setupContainerDragAndDrop();
                this.containerDragSetup = true;
            }
            
            // Add event listeners to account cards
            setTimeout(() => {
                // Initialize dropdowns
                document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(element => {
                    new window.bootstrap.Dropdown(element);
                });
                
                this.filteredAccounts.forEach(account => {
                    const card = document.querySelector(`[data-account-id="${account.id}"]`);
                    if (card) {
                        const copyBtn = card.querySelector(".copy-btn");
                        if (copyBtn) {
                            copyBtn.addEventListener("click", async (e) => {
                                e.stopPropagation();
                                await this.copyOTP(account);
                            });
                        }

                        const editBtn = card.querySelector(".edit-account-btn");
                        if (editBtn) {
                            editBtn.addEventListener("click", (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                this.showEditForm(account);
                            });
                        }

                        const deleteBtn = card.querySelector(".delete-account-btn");
                        if (deleteBtn) {
                            deleteBtn.addEventListener("click", (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                this.deleteAccount(account);
                            });
                        }
                    }
                });
            }, 0);
        }
    }

    async renderAccountCard(account) {
        const otp = await this.generateOTP(account.id);
        const timeLeft = this.getTimeLeft();
        const timerClass = timeLeft <= 10 ? "danger" : timeLeft <= 20 ? "warning" : "";
        
        // Get folder name for display
        const folder = this.folders.find(f => f.id === account.folderId);
        const folderName = folder ? folder.name : 'Uncategorized';

        return `
            <div class="account-card fade-in" data-account-id="${account.id}">
                <div class="account-header">
                    <div class="d-flex align-items-center gap-2">
                        <div class="drag-handle" draggable="true" title="Drag to reorder">
                            <i class="bi bi-grip-vertical"></i>
                        </div>
                        <div class="account-service">${account.service}</div>
                        <div class="account-folder-badge">${folderName}</div>
                    </div>
                    <div class="account-buttons">
                        <div class="dropdown">
                            <button class="options-btn" data-bs-toggle="dropdown" title="More options">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item edit-account-btn" href="#"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item delete-account-btn text-danger" href="#"><i class="bi bi-trash me-2"></i>Delete</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="account-name">${account.name}</div>
                <div class="account-email">${account.email}</div>
                <div class="otp-section">
                    <div class="otp-left-section">
                        <div class="otp-code" data-otp="${otp}">${this.formatOTP(otp)}</div>
                        <button class="copy-btn" title="Copy code">
                            <i class="bi bi-copy"></i>
                        </button>
                    </div>
                    <div class="otp-timer ${timerClass}">${timeLeft}</div>
                </div>
            </div>
        `;
    }

    setupContainerDragAndDrop() {
        const container = document.getElementById('accountsContainer');
        
        // Handle dragstart on grip handles using event delegation
        container.addEventListener('dragstart', (e) => {
            if (e.target.closest('.drag-handle')) {
                const card = e.target.closest('.account-card');
                if (card) {
                    this.draggedElement = card;
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/html', '');
                    
                    // Show drop zones and folder drop zones
                    this.showDropZones();
                    this.showFolderDropZones();
                }
            }
        });

        // Handle dragend using event delegation
        container.addEventListener('dragend', (e) => {
            if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
                
                // Hide drop zones
                this.hideDropZones();
                this.hideFolderDropZones();
            }
        });

        // Additional safety: hide drop zones on mouse leave during drag
        container.addEventListener('mouseleave', (e) => {
            if (this.draggedElement && this.dropZonesVisible) {
                // Add a small delay to avoid hiding when just moving between elements
                setTimeout(() => {
                    if (this.dropZonesVisible && !container.matches(':hover')) {
                        this.hideDropZones();
                        this.hideFolderDropZones();
                        if (this.draggedElement) {
                            this.draggedElement.classList.remove('dragging');
                            this.draggedElement = null;
                        }
                    }
                }, 100);
            }
        });

        // Handle dragover on drop zones
        container.addEventListener('dragover', (e) => {
            if (this.draggedElement) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                // Highlight drop zone
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    this.highlightDropZone(dropZone);
                }
            }
        });

        // Handle dragleave on drop zones
        container.addEventListener('dragleave', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            if (dropZone && !dropZone.contains(e.relatedTarget)) {
                this.unhighlightDropZone(dropZone);
            }
        });

        // Handle drop on drop zones
        container.addEventListener('drop', (e) => {
            const dropZone = e.target.closest('.drop-zone');
            if (this.draggedElement && dropZone) {
                e.preventDefault();
                
                const targetIndex = parseInt(dropZone.dataset.index);
                
                // Hide drop zones first to get clean DOM
                this.hideDropZones();
                
                // Get current cards (excluding the dragged one)
                const currentCards = Array.from(container.querySelectorAll('.account-card:not(.dragging)'));
                
                // Remove dragged element temporarily
                this.draggedElement.remove();
                this.draggedElement.classList.remove('dragging');
                
                // Insert at the correct position
                if (targetIndex === 0) {
                    // Insert at the beginning
                    if (currentCards.length > 0) {
                        container.insertBefore(this.draggedElement, currentCards[0]);
                    } else {
                        container.appendChild(this.draggedElement);
                    }
                } else if (targetIndex >= currentCards.length) {
                    // Insert at the end
                    container.appendChild(this.draggedElement);
                } else {
                    // Insert at specific position
                    container.insertBefore(this.draggedElement, currentCards[targetIndex]);
                }
                
                // Clean up
                this.draggedElement = null;
                
                // Update order and save
                this.updateAccountOrder();
            }
        });

        // Global cleanup on document mouse events
        document.addEventListener('mouseup', () => {
            if (this.dropZonesVisible) {
                setTimeout(() => {
                    this.hideDropZones();
                    if (this.draggedElement) {
                        this.draggedElement.classList.remove('dragging');
                        this.draggedElement = null;
                    }
                }, 100);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.dropZonesVisible) {
                this.hideDropZones();
                this.hideFolderDropZones();
                if (this.draggedElement) {
                    this.draggedElement.classList.remove('dragging');
                    this.draggedElement = null;
                }
            }
        });

        // Setup folder drag and drop
        this.setupFolderDragAndDrop();
    }

    setupFolderDragAndDrop() {
        const foldersList = document.getElementById('foldersList');
        if (!foldersList) return;

        // Handle dragover on folders
        foldersList.addEventListener('dragover', (e) => {
            if (this.draggedElement) {
                const folderItem = e.target.closest('.folder-item');
                if (folderItem && folderItem.dataset.folderId !== 'all') {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    this.highlightFolder(folderItem);
                }
            }
        });

        // Handle dragleave on folders
        foldersList.addEventListener('dragleave', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && !folderItem.contains(e.relatedTarget)) {
                this.unhighlightFolder(folderItem);
            }
        });

        // Handle drop on folders
        foldersList.addEventListener('drop', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (this.draggedElement && folderItem) {
                e.preventDefault();
                
                const targetFolderId = folderItem.dataset.folderId;
                const accountId = this.draggedElement.dataset.accountId;
                
                // Don't allow drop on "all" folder
                if (targetFolderId !== 'all') {
                    this.moveAccountToFolder(accountId, targetFolderId);
                }
                
                // Clean up
                this.hideDropZones();
                this.hideFolderDropZones();
                if (this.draggedElement) {
                    this.draggedElement.classList.remove('dragging');
                    this.draggedElement = null;
                }
            }
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.account-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    showDropZones() {
        if (this.dropZonesVisible) return;
        
        const container = document.getElementById('accountsContainer');
        const cards = Array.from(container.querySelectorAll('.account-card:not(.dragging)'));
        
        // Store original cards order for reference
        this.originalCardsOrder = cards.map(card => ({
            element: card,
            id: card.dataset.accountId
        }));
        
        if (cards.length === 0) {
            // If no cards, add one drop zone
            const endDropZone = this.createDropZone(0, null);
            container.appendChild(endDropZone);
        } else {
            // Insert drop zones between cards
            for (let i = 0; i <= cards.length; i++) {
                const dropZone = this.createDropZone(i, null);
                
                if (i === 0) {
                    // Before first card
                    container.insertBefore(dropZone, cards[0]);
                } else if (i === cards.length) {
                    // After last card
                    container.appendChild(dropZone);
                } else {
                    // Between cards
                    container.insertBefore(dropZone, cards[i]);
                }
            }
        }
        
        // Show all drop zones with animation
        setTimeout(() => {
            container.querySelectorAll('.drop-zone').forEach(zone => {
                zone.classList.add('visible');
            });
        }, 10);
        
        this.dropZonesVisible = true;
    }

    hideDropZones() {
        const container = document.getElementById('accountsContainer');
        const dropZones = container.querySelectorAll('.drop-zone');
        
        dropZones.forEach(zone => {
            zone.classList.remove('visible', 'drag-over');
        });
        
        // Remove drop zones after animation
        setTimeout(() => {
            dropZones.forEach(zone => zone.remove());
        }, 200);
        
        this.dropZonesVisible = false;
    }

    createDropZone(index, cardId) {
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        dropZone.dataset.index = index;
        if (cardId) dropZone.dataset.cardId = cardId;
        return dropZone;
    }

    highlightDropZone(dropZone) {
        // Remove highlight from all other drop zones
        const container = document.getElementById('accountsContainer');
        container.querySelectorAll('.drop-zone.drag-over').forEach(zone => {
            if (zone !== dropZone) {
                zone.classList.remove('drag-over');
            }
        });
        
        // Highlight current drop zone
        dropZone.classList.add('drag-over');
    }

    unhighlightDropZone(dropZone) {
        dropZone.classList.remove('drag-over');
    }

    showFolderDropZones() {
        // Add visual indicator to all folders that they can accept drops
        const folderItems = document.querySelectorAll('.folder-item[data-folder-id]:not([data-folder-id="all"])');
        folderItems.forEach(folder => {
            folder.classList.add('drag-target');
        });
    }

    hideFolderDropZones() {
        // Remove visual indicators from folders
        const folderItems = document.querySelectorAll('.folder-item');
        folderItems.forEach(folder => {
            folder.classList.remove('drag-target', 'drag-over');
        });
    }

    highlightFolder(folderItem) {
        // Remove highlight from all other folders
        document.querySelectorAll('.folder-item.drag-over').forEach(folder => {
            if (folder !== folderItem) {
                folder.classList.remove('drag-over');
            }
        });
        
        // Highlight current folder
        folderItem.classList.add('drag-over');
    }

    unhighlightFolder(folderItem) {
        folderItem.classList.remove('drag-over');
    }

    async moveAccountToFolder(accountId, targetFolderId) {
        try {
            // Update account folder
            const success = await this.storageManager.updateAccount(accountId, { 
                folderId: targetFolderId 
            });
            
            if (success) {
                // Update local account data
                const account = this.accounts.find(acc => acc.id === accountId);
                if (account) {
                    account.folderId = targetFolderId;
                }
                
                // Refresh UI
                this.filterAndSortAccounts();
                await this.renderFolders();
                await this.renderAccounts();
                
                // Show success message
                const targetFolder = this.folders.find(f => f.id === targetFolderId) || 
                                   { name: targetFolderId === 'uncategorized' ? 'Uncategorized' : targetFolderId };
                this.showToast(`Account moved to ${targetFolder.name}`, "success");
            } else {
                this.showToast("Failed to move account", "error");
            }
        } catch (error) {
            console.error("Error moving account to folder:", error);
            this.showToast("Error moving account", "error");
        }
    }

    async updateAccountOrder() {
        const cards = document.querySelectorAll('.account-card');
        const newOrder = Array.from(cards).map((card, index) => {
            const accountId = card.getAttribute('data-account-id');
            const account = this.accounts.find(acc => acc.id === accountId);
            if (account) {
                account.sortOrder = index;
                return account;
            }
        }).filter(Boolean);

        // Update accounts in storage with new order
        for (const account of newOrder) {
            await this.storageManager.updateAccount(account.id, { sortOrder: account.sortOrder });
        }
        
        // Update local accounts array with new order
        this.accounts = await this.storageManager.getAccounts();
        this.filterAndSortAccounts();
    }

    async generateOTP(accountId) {
        try {
            // Get decrypted secret
            const secret = await this.storageManager.getDecryptedSecret(accountId);
            if (!secret) {
                return "🔒LOCKED";
            }

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
            return "❌ERROR";
        }
    }

    formatOTP(otp) {
        if (otp === "🔒LOCKED" || otp === "❌ERROR" || otp === "------") return otp;
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
                    const newOTP = await this.generateOTP(account.id);
                    element.textContent = this.formatOTP(newOTP);
                    element.setAttribute("data-otp", newOTP);
                }
            });
            
            await Promise.all(updates);
        }
    }

    async copyOTP(account) {
        const otp = await this.generateOTP(account.id);
        
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
        
        const otp = await this.generateOTP(account.id);
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
        // Language selector removed - English only
    }

    async toggleLanguage() {
        // Language toggle removed - English only
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showEditForm(account) {
        this.currentEditingAccount = account;
        
        // Populate form with current values
        document.getElementById("editAccountName").value = account.name;
        document.getElementById("editServiceName").value = account.service;
        document.getElementById("editAccountEmail").value = account.email;
        document.getElementById("editAccountFolder").value = account.folderId || 'uncategorized';
        
        // Show edit form
        document.getElementById("editAccountForm").classList.remove("d-none");
        document.getElementById("editAccountName").focus();
    }

    hideEditForm() {
        document.getElementById("editAccountForm").classList.add("d-none");
        document.getElementById("editAccountFormEl").reset();
        this.currentEditingAccount = null;
    }

    async handleEditAccount() {
        if (!this.currentEditingAccount) return;

        const formData = {
            name: document.getElementById("editAccountName").value.trim(),
            service: document.getElementById("editServiceName").value,
            email: document.getElementById("editAccountEmail").value.trim(),
            folderId: document.getElementById("editAccountFolder").value
        };

        // Validate form data
        if (!formData.name || !formData.service || !formData.email) {
            this.showToast("Please fill all fields", "error");
            return;
        }

        try {
            // Update account in storage
            const updateData = {
                name: formData.name,
                service: formData.service,
                email: formData.email,
                folderId: formData.folderId
            };

            const success = await this.storageManager.updateAccount(this.currentEditingAccount.id, updateData);
            
            if (success) {
                // Update local account data
                const accountIndex = this.accounts.findIndex(acc => acc.id === this.currentEditingAccount.id);
                if (accountIndex !== -1) {
                    this.accounts[accountIndex] = { ...this.accounts[accountIndex], ...updateData };
                }
                
                this.filterAndSortAccounts();
                await this.renderFolders();
                await this.renderAccounts();
                this.hideEditForm();
                this.showToast("Account updated successfully", "success");
            } else {
                this.showToast("Failed to update account", "error");
            }
        } catch (error) {
            console.error("Error updating account:", error);
            this.showToast("Error updating account", "error");
        }
    }

    async deleteAccount(account) {
        if (!confirm(`Are you sure you want to delete the account for ${account.name}? This action cannot be undone.`)) {
            return;
        }

        try {
            const success = await this.storageManager.deleteAccount(account.id);
            
            if (success) {
                // Remove from local arrays
                this.accounts = this.accounts.filter(acc => acc.id !== account.id);
                this.filterAndSortAccounts();
                
                await this.renderFolders();
                await this.renderAccounts();
                this.showToast("Account deleted successfully", "success");
            } else {
                this.showToast("Failed to delete account", "error");
            }
        } catch (error) {
            console.error("Error deleting account:", error);
            this.showToast("Error deleting account", "error");
        }
    }

    // Folder Management Functions
    async renderFolders() {
        const foldersList = document.getElementById("foldersList");
        
        // Get folder counts
        const folderCounts = {};
        this.accounts.forEach(account => {
            const folderId = account.folderId || 'uncategorized';
            folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
        });

        const totalCount = this.accounts.length;
        
        let html = `
            <div class="folder-item ${this.currentFolderId === 'all' ? 'active' : ''}" data-folder-id="all">
                <div class="folder-info">
                    <i class="bi bi-collection"></i>
                    <span>All Accounts</span>
                </div>
                <span class="folder-count">${totalCount}</span>
            </div>
        `;

        // Add default folders
        const defaultFolders = [
            { id: 'uncategorized', name: 'Uncategorized', icon: 'bi-folder' }
        ];

        defaultFolders.forEach(folder => {
            const count = folderCounts[folder.id] || 0;
            html += `
                <div class="folder-item ${this.currentFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}">
                    <div class="folder-info">
                        <i class="bi ${folder.icon}"></i>
                        <span>${folder.name}</span>
                    </div>
                    <span class="folder-count">${count}</span>
                </div>
            `;
        });

        // Add custom folders
        this.folders.forEach(folder => {
            const count = folderCounts[folder.id] || 0;
            html += `
                <div class="folder-item ${this.currentFolderId === folder.id ? 'active' : ''}" data-folder-id="${folder.id}">
                    <div class="folder-info">
                        <i class="bi ${folder.icon || 'bi-folder'}"></i>
                        <span>${folder.name}</span>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <span class="folder-count">${count}</span>
                        <div class="folder-options dropdown">
                            <button class="dropdown-toggle" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item edit-folder-btn" href="#" data-folder-id="${folder.id}">
                                    <i class="bi bi-pencil me-2"></i>Edit
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item delete-folder-btn text-danger" href="#" data-folder-id="${folder.id}">
                                    <i class="bi bi-trash me-2"></i>Delete
                                </a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });

        foldersList.innerHTML = html;

        // Update current folder name
        this.updateCurrentFolderName();

        // Add folder click listeners
        setTimeout(() => {
            document.querySelectorAll('.folder-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.closest('.folder-options')) {
                        this.selectFolder(item.dataset.folderId);
                    }
                });
            });

            // Add folder management listeners
            document.querySelectorAll('.edit-folder-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.editFolder(btn.dataset.folderId);
                });
            });

            document.querySelectorAll('.delete-folder-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.deleteFolder(btn.dataset.folderId);
                });
            });
        }, 0);

        // Update folder options in forms
        this.updateFolderOptions();
        
        // Setup folder drag and drop after rendering
        setTimeout(() => {
            this.setupFolderDragAndDrop();
        }, 10);
    }

    updateCurrentFolderName() {
        const nameElement = document.getElementById('currentFolderName');
        if (this.currentFolderId === 'all') {
            nameElement.textContent = 'All Accounts';
        } else if (this.currentFolderId === 'uncategorized') {
            nameElement.textContent = 'Uncategorized';
        } else {
            const folder = this.folders.find(f => f.id === this.currentFolderId);
            nameElement.textContent = folder ? folder.name : 'Unknown Folder';
        }
    }

    selectFolder(folderId) {
        this.currentFolderId = folderId;
        this.filterAndSortAccounts();
        this.renderFolders();
        this.renderAccounts();
    }

    updateFolderOptions() {
        const addFolderSelect = document.getElementById('accountFolder');
        const editFolderSelect = document.getElementById('editAccountFolder');

        let options = '<option value="uncategorized">Uncategorized</option>';
        this.folders.forEach(folder => {
            options += `<option value="${folder.id}">${folder.name}</option>`;
        });

        addFolderSelect.innerHTML = options;
        editFolderSelect.innerHTML = options;
    }

    showAddFolderForm() {
        document.getElementById("addFolderForm").classList.remove("d-none");
        document.getElementById("folderName").focus();
    }

    hideAddFolderForm() {
        document.getElementById("addFolderForm").classList.add("d-none");
        document.getElementById("folderForm").reset();
    }

    async handleAddFolder() {
        const formData = {
            name: document.getElementById("folderName").value.trim(),
            icon: document.getElementById("folderIcon").value
        };

        if (!formData.name) {
            this.showToast("Please enter folder name", "error");
            return;
        }

        try {
            const folder = {
                id: this.generateId(),
                name: formData.name,
                icon: formData.icon,
                createdAt: new Date().toISOString()
            };

            const success = await this.storageManager.addFolder(folder);
            
            if (success) {
                this.folders.push(folder);
                await this.renderFolders();
                this.hideAddFolderForm();
                this.showToast("Folder added successfully", "success");
            } else {
                this.showToast("Failed to add folder", "error");
            }
        } catch (error) {
            console.error("Error adding folder:", error);
            this.showToast("Error adding folder", "error");
        }
    }

    async editFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;

        const newName = prompt("Enter new folder name:", folder.name);
        if (!newName || newName === folder.name) return;

        try {
            const success = await this.storageManager.updateFolder(folderId, { name: newName });
            
            if (success) {
                folder.name = newName;
                await this.renderFolders();
                this.showToast("Folder updated successfully", "success");
            } else {
                this.showToast("Failed to update folder", "error");
            }
        } catch (error) {
            console.error("Error updating folder:", error);
            this.showToast("Error updating folder", "error");
        }
    }

    async deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder) return;

        const accountsInFolder = this.accounts.filter(acc => acc.folderId === folderId);
        let message = `Are you sure you want to delete the folder "${folder.name}"?`;
        
        if (accountsInFolder.length > 0) {
            message += `\n\n${accountsInFolder.length} accounts in this folder will be moved to "Uncategorized".`;
        }

        if (!confirm(message)) return;

        try {
            // Move accounts to uncategorized
            if (accountsInFolder.length > 0) {
                for (const account of accountsInFolder) {
                    await this.storageManager.updateAccount(account.id, { folderId: 'uncategorized' });
                    account.folderId = 'uncategorized';
                }
            }

            const success = await this.storageManager.deleteFolder(folderId);
            
            if (success) {
                this.folders = this.folders.filter(f => f.id !== folderId);
                
                // If current folder was deleted, switch to all
                if (this.currentFolderId === folderId) {
                    this.currentFolderId = 'all';
                }
                
                this.filterAndSortAccounts();
                await this.renderFolders();
                await this.renderAccounts();
                this.showToast("Folder deleted successfully", "success");
            } else {
                this.showToast("Failed to delete folder", "error");
            }
        } catch (error) {
            console.error("Error deleting folder:", error);
            this.showToast("Error deleting folder", "error");
        }
    }

    // ===============================
    // Authentication Methods
    // ===============================

    async checkAuthenticationRequired() {
        // Check if password auth is set up
        const hasAuth = await this.cryptoManager.isPasswordAuthSetup();
        
        // If no auth setup, need to set it up
        if (!hasAuth) {
            return true;
        }
        
        // If auth is set up, check if we need to authenticate
        return !this.cryptoManager.isAuthenticated();
    }

    async showAuthenticationModal() {
        const modal = document.getElementById("authModal");
        if (!modal) return;

        // Show appropriate sections
        const passwordSection = document.getElementById("passwordSection");
        const setupSection = document.getElementById("setupSection");
        
        // Check if this is first time setup
        const hasAuth = await this.cryptoManager.isPasswordAuthSetup();
        const isFirstTime = !hasAuth;
        
        if (isFirstTime) {
            // First time setup - show setup options
            setupSection.classList.remove('d-none');
            passwordSection.classList.add('d-none');
        } else {
            // Normal authentication - show password entry
            setupSection.classList.add('d-none');
            passwordSection.classList.remove('d-none');
        }

        modal.classList.add('show');
        modal.style.display = 'block';
        document.body.classList.add('modal-open');
        
        // Setup event listeners after modal is shown
        this.setupAuthEventListeners();
    }

    setupAuthEventListeners() {
        console.log("Setting up auth event listeners...");

        // Password auth button
        const passwordAuthBtn = document.getElementById("passwordAuthBtn");
        if (passwordAuthBtn) {
            console.log("Password auth button found");
            passwordAuthBtn.onclick = () => {
                console.log("Password auth button clicked!");
                this.authenticateWithPassword();
            };
        }

        // Setup password button
        const setupPasswordBtn = document.getElementById("setupPasswordBtn");
        if (setupPasswordBtn) {
            console.log("Setup password button found");
            setupPasswordBtn.onclick = () => {
                console.log("Setup password button clicked!");
                this.setupPasswordAuth();
            };
        }

        // Enter key for password
        const masterPasswordInput = document.getElementById("masterPassword");
        if (masterPasswordInput) {
            masterPasswordInput.onkeypress = (e) => {
                if (e.key === "Enter") {
                    this.authenticateWithPassword();
                }
            };
        }
        
        // Enter key for setup password
        const newPasswordInput = document.getElementById("newMasterPassword");
        if (newPasswordInput) {
            newPasswordInput.onkeypress = (e) => {
                if (e.key === "Enter") {
                    this.setupPasswordAuth();
                }
            };
        }
    }

    hideAuthenticationModal() {
        const modal = document.getElementById("authModal");
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    async authenticateWithSystem() {
        try {
            const success = await this.cryptoManager.generateEncryptionKey();
            if (success) {
                this.isAuthenticated = true;
                this.hideAuthenticationModal();
                await this.completeInitialization();
            } else {
                this.showToast("System authentication failed", "error");
            }
        } catch (error) {
            console.error("System auth error:", error);
            this.showToast("System authentication failed", "error");
        }
    }

    async authenticateWithPassword() {
        const passwordInput = document.getElementById("masterPassword");
        const password = passwordInput.value.trim();
        
        if (!password) {
            this.showToast("Please enter your PIN/password", "error");
            return;
        }
        
        try {
            const success = await this.cryptoManager.authenticateWithPassword(password);
            if (success) {
                this.isAuthenticated = true;
                this.hideAuthenticationModal();
                await this.completeInitialization();
                passwordInput.value = '';
                this.showToast("Authentication successful!", "success");
            } else {
                this.showToast("Invalid PIN/password", "error");
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error("Password auth error:", error);
            this.showToast("Authentication failed", "error");
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    async setupSystemAuth() {
        try {
            console.log("Setting up system auth...");
            const success = await this.cryptoManager.setupSystemAuth();
            console.log("Setup result:", success);
            
            if (success) {
                localStorage.setItem('twinkey_has_auth', 'true');
                this.isAuthenticated = true;
                this.hideAuthenticationModal();
                await this.completeInitialization();
                this.showToast("System authentication setup successfully!", "success");
            } else {
                this.showToast("Failed to setup system authentication", "error");
            }
        } catch (error) {
            console.error("System setup error:", error);
            this.showToast("Failed to setup system authentication: " + error.message, "error");
        }
    }

    async setupPasswordAuth() {
        const newPassword = document.getElementById("newMasterPassword").value.trim();
        
        if (!newPassword) {
            this.showToast("Please enter a PIN or password", "error");
            return;
        }
        
        if (newPassword.length < 3) {
            this.showToast("PIN/Password must be at least 3 characters", "error");
            return;
        }
        
        try {
            const success = await this.cryptoManager.generateEncryptionKey(newPassword);
            if (success) {
                // Mark that auth is set up using extension storage
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ 'twinkey_has_auth': 'true' });
                } else {
                    localStorage.setItem('twinkey_has_auth', 'true');
                }
                
                this.isAuthenticated = true;
                this.hideAuthenticationModal();
                await this.completeInitialization();
                this.showToast("Authentication setup successfully!", "success");
            } else {
                this.showToast("Failed to setup authentication", "error");
            }
        } catch (error) {
            console.error("Password setup error:", error);
            this.showToast("Failed to setup authentication", "error");
        }
    }

    async completeInitialization() {
        await this.loadData();
        this.setupEventListeners();
        await this.renderFolders();
        await this.renderAccounts();
        this.startOTPUpdater();
        this.setupLanguageSelector();

        // Handle pending account if exists
        if (this.pendingAccount) {
            const account = {
                id: this.generateId(),
                ...this.pendingAccount,
                createdAt: new Date().toISOString(),
                lastUsed: null
            };

            const success = await this.storageManager.addAccount(account);
            if (success) {
                this.accounts.push(account);
                this.filterAndSortAccounts();
                await this.renderAccounts();
                this.hideAddForm();
                this.showToast("Account added successfully!", "success");
            } else {
                this.showToast("Failed to add account", "error");
            }
            
            this.pendingAccount = null;
        }
    }

    // ===============================
    // UI Methods
    // ===============================

    openInNewTab() {
        if (typeof chrome !== 'undefined' && chrome.windows) {
            // Chrome extension environment - create a fixed-size window
            const currentUrl = chrome.runtime.getURL('popup.html');
            chrome.windows.create({
                url: currentUrl,
                type: 'popup',
                width: 1100,
                height: 850,
                left: Math.round((screen.availWidth - 1100) / 2),
                top: Math.round((screen.availHeight - 850) / 2),
                focused: true
            });
        } else {
            // Fallback for development environment
            const width = 1100;
            const height = 850;
            const left = (screen.width - width) / 2;
            const top = (screen.height - height) / 2;
            
            window.open(
                'popup.html', 
                'TwinKey', 
                `width=${width},height=${height},left=${left},top=${top},resizable=no,scrollbars=no,menubar=no,toolbar=no,location=no,status=no`
            );
        }
    }

    // ===============================
    // Settings Methods
    // ===============================

    showSettingsModal() {
        const modal = document.getElementById("settingsModal");
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            this.updateSettingsStats();
        }
    }

    hideSettingsModal() {
        const modal = document.getElementById("settingsModal");
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    showExportOptionsModal() {
        const modal = document.getElementById("exportOptionsModal");
        if (modal) {
            // Reset form
            document.getElementById("exportEncrypted").checked = true;
            document.getElementById("exportUnencrypted").checked = false;
            document.getElementById("exportPassword").value = "";
            this.toggleExportPasswordSection(true);
            
            // Show modal
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
        }
    }

    hideExportOptionsModal() {
        const modal = document.getElementById("exportOptionsModal");
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    }

    toggleExportPasswordSection(show) {
        const passwordSection = document.getElementById("exportPasswordSection");
        if (passwordSection) {
            if (show) {
                passwordSection.classList.remove("d-none");
            } else {
                passwordSection.classList.add("d-none");
            }
        }
    }

    async handleExport() {
        try {
            const exportType = document.querySelector('input[name="exportType"]:checked').value;
            const exportPassword = document.getElementById("exportPassword").value;

            // Validate password for encrypted export
            if (exportType === 'encrypted') {
                if (!exportPassword || exportPassword.length < 4) {
                    this.showToast("Please enter a password (at least 4 characters)", "error");
                    return;
                }
            }

            // Export data with or without password
            const password = exportType === 'encrypted' ? exportPassword : null;
            const data = await this.storageManager.exportData(password);
            
            if (!data) {
                this.showToast("Error exporting data", "error");
                return;
            }

            // Create filename with current date and encryption indicator
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + 
                          String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(now.getDate()).padStart(2, '0');
            const encryptedSuffix = exportType === 'encrypted' ? '-encrypted' : '';
            const filename = `twinkey-backup-${dateStr}${encryptedSuffix}.json`;

            // Create download link
            const blob = new Blob([JSON.stringify(data, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Hide modal and show success message
            this.hideExportOptionsModal();
            const message = exportType === 'encrypted' 
                ? "Data exported successfully with password protection"
                : "Data exported successfully without encryption";
            this.showToast(message, "success");
            
        } catch (error) {
            console.error("Error exporting data:", error);
            this.showToast("Error exporting data", "error");
        }
    }

    async handleFileSelection(event) {
        const fileInput = event.target;
        const importBtn = document.getElementById("importBtn");
        const importPasswordSection = document.getElementById("importPasswordSection");
        
        importBtn.disabled = !fileInput.files.length;
        
        if (fileInput.files.length > 0) {
            try {
                // Read and parse file to check if it's encrypted
                const file = fileInput.files[0];
                const text = await file.text();
                const data = JSON.parse(text);
                
                // Show/hide password section based on encryption
                if (data.encrypted && data.encryptedData) {
                    importPasswordSection.classList.remove("d-none");
                } else {
                    importPasswordSection.classList.add("d-none");
                }
            } catch (error) {
                console.error("Error reading file:", error);
                importPasswordSection.classList.add("d-none");
            }
        } else {
            importPasswordSection.classList.add("d-none");
        }
    }

    async importData() {
        try {
            const fileInput = document.getElementById("importFile");
            const importPasswordInput = document.getElementById("importPassword");
            const file = fileInput.files[0];
            
            if (!file) {
                this.showToast("Please select a file", "error");
                return;
            }

            // Read file
            const text = await file.text();
            const data = JSON.parse(text);

            // Check if file is encrypted and password is required
            if (data.encrypted && data.encryptedData) {
                const importPassword = importPasswordInput.value;
                if (!importPassword) {
                    this.showToast("Please enter the import password", "error");
                    return;
                }
            }

            // Validate data structure for unencrypted files
            if (!data.encrypted && !data.accounts && !data.folders && !data.settings && !data.encryptedData) {
                this.showToast("Invalid backup file format", "error");
                return;
            }

            // Confirm replacement
            const confirmed = confirm("This will replace all existing data. Are you sure?");
            if (!confirmed) {
                return;
            }

            // Import data with password if needed
            const importPassword = data.encrypted ? importPasswordInput.value : null;
            const success = await this.storageManager.importData(data, importPassword);
            
            if (!success) {
                this.showToast("Error importing data. Please check password or file format.", "error");
                return;
            }

            // Reload data and refresh UI
            await this.loadData();
            await this.renderFolders();
            await this.renderAccounts();
            
            // Close modal and clear file input
            this.hideSettingsModal();
            fileInput.value = '';
            importPasswordInput.value = '';
            document.getElementById("importBtn").disabled = true;
            document.getElementById("importPasswordSection").classList.add("d-none");

            this.showToast("Data imported successfully", "success");
        } catch (error) {
            console.error("Error importing data:", error);
            if (error.message.includes("Invalid password")) {
                this.showToast("Invalid password or corrupted file", "error");
            } else {
                this.showToast("Error importing data. Please check file format.", "error");
            }
        }
    }

    async updateSettingsStats() {
        try {
            const accounts = await this.storageManager.getAccounts();
            const folders = await this.storageManager.getFolders();
            const storageSize = this.storageManager.getStorageSize();
            
            const statsAccounts = document.getElementById("statsAccounts");
            const statsFolders = document.getElementById("statsFolders");
            const statsStorage = document.getElementById("statsStorage");
            
            if (statsAccounts) statsAccounts.textContent = accounts.length;
            if (statsFolders) statsFolders.textContent = folders.length;
            if (statsStorage) {
                statsStorage.textContent = Math.round(storageSize / 1024 * 10) / 10 + " KB";
            }
        } catch (error) {
            console.error("Error updating stats:", error);
        }
    }

}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new PopupManager();
});