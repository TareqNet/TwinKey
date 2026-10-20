// Twin Key popup controller: lock screen, folders, account grid, dialogs.
// All DOM is built with createElement/textContent — user data is never parsed as HTML.

const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
const t = (key, params) => window.i18n.t(key, params);

/**
 * Create an element. String children become text nodes.
 * attrs: class, dataset {}, on {event: handler}, other attributes (true → "", false/null → skipped).
 */
function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === false || value == null) continue;
        if (key === "class") el.className = value;
        else if (key === "dataset") Object.assign(el.dataset, value);
        else if (key === "on") Object.entries(value).forEach(([event, handler]) => el.addEventListener(event, handler));
        else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...children.flat().filter(child => child != null && child !== false));
    return el;
}

function icon(name, className = "icon") {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
}

// Stable hue per service/name for the avatar tint
function hueFor(text) {
    return Array.from(text || "?").reduce((hash, char) => (hash * 31 + char.codePointAt(0)) % 360, 7);
}

// Stored folder icon value → [sprite id, label]
const FOLDER_ICONS = {
    "bi-folder": ["folder", "Default"],
    "bi-briefcase": ["briefcase", "Work"],
    "bi-house": ["home", "Personal"],
    "bi-shield-lock": ["lock", "Security"],
    "bi-code-slash": ["code", "Development"],
    "bi-credit-card": ["card", "Finance"],
    "bi-people": ["users", "Social"],
    "bi-cloud": ["cloud", "Cloud"]
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 9;

class PopupManager {
    constructor() {
        this.storageManager = new StorageManager();
        this.cryptoManager = new CryptoManager();
        this.totpGenerator = new TOTPGenerator();
        this.accounts = [];
        this.filteredAccounts = [];
        this.folders = [];
        this.settings = {};
        this.currentFolderId = "all";
        this.sortBy = "custom";
        this.searchQuery = "";
        this.isAuthenticated = false;
        this.ticker = null;
        this.lastCounter = null;
        this.inactivityTimer = null;
        this.toastTimer = null;
        this.editingAccountId = null;
        this.editingFolderId = null;
        this.draggedCard = null;
        this.menuAnchor = null;
        this.isDetached = new URLSearchParams(location.search).has("window");

        this.init();
    }

    async init() {
        if (this.isDetached) document.documentElement.classList.add("detached");
        await window.i18n.ready;

        await this.storageManager.initializeCrypto(this.cryptoManager);
        this.storageManager.isEncryptionEnabled = true;
        this.settings = (await this.storageManager.getSettings()) || {};
        // "appearance" is only written by the theme picker; the legacy "theme: light" default is ignored
        this.applyTheme(this.settings.appearance || "auto");

        this.buildIconPicker();
        this.bindEvents();

        // One-shot auth hand-off from "Unlock in a new window"
        try {
            const session = await chrome.storage.session.get(["twinkey_handoff", "temp_auth_password"]);
            // Always clear first, including the legacy key, so a stale value can never log anyone in
            await chrome.storage.session.remove(["twinkey_handoff", "temp_auth_password"]);
            const handoff = session.twinkey_handoff;
            if (handoff && typeof handoff.password === "string" && Date.now() < handoff.expiresAt
                && await this.cryptoManager.authenticateWithPassword(handoff.password)) {
                await this.unlock(handoff.password);
                return;
            }
        } catch (error) {
            console.error("Error checking session storage:", error);
        }

        await this.showLockScreen();
    }

    // ===============================
    // Events (bound once for the page lifetime)
    // ===============================

    bindEvents() {
        $("unlockForm").addEventListener("submit", (e) => this.handleUnlock(e));
        $("setupForm").addEventListener("submit", (e) => this.handleSetup(e));
        $("openWindowFromLockBtn").addEventListener("click", () => this.openWindowFromLock());

        $("openWindowBtn").addEventListener("click", () => this.openInNewWindow());
        $("settingsBtn").addEventListener("click", () => this.openSettings());
        $("addAccountBtn").addEventListener("click", () => this.openAccountDialog());
        $("emptyAddBtn").addEventListener("click", () => this.openAccountDialog());
        $("addFolderBtn").addEventListener("click", () => this.openFolderDialog());
        $("weakPinChangeBtn").addEventListener("click", () => {
            this.openSettings();
            $("currentPin").focus();
        });

        $("searchInput").addEventListener("input", (e) => {
            this.searchQuery = e.target.value.trim();
            this.renderAccounts();
        });
        $("searchInput").addEventListener("keydown", (e) => {
            if (e.key === "Escape" && e.target.value) {
                e.preventDefault();
                e.target.value = "";
                this.searchQuery = "";
                this.renderAccounts();
            }
        });
        $("sortSelect").addEventListener("change", (e) => {
            this.sortBy = e.target.value;
            this.renderAccounts();
        });
        $("folderSelect").addEventListener("change", (e) => this.selectFolder(e.target.value));

        $("accountForm").addEventListener("submit", (e) => this.handleAccountSubmit(e));
        $("folderForm").addEventListener("submit", (e) => this.handleFolderSubmit(e));
        $("changePinForm").addEventListener("submit", (e) => this.handleChangePin(e));
        $("exportBtn").addEventListener("click", () => this.openExportDialog());
        $("exportForm").addEventListener("submit", (e) => this.handleExport(e));
        document.querySelectorAll('input[name="exportType"]').forEach(radio => {
            radio.addEventListener("change", () => {
                $("exportPasswordSection").hidden = !$("exportEncrypted").checked;
            });
        });
        $("importFile").addEventListener("change", (e) => this.handleFileSelection(e));
        $("importForm").addEventListener("submit", (e) => this.handleImport(e));
        document.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener("change", () => this.saveTheme(radio.value));
        });

        // Dialogs: [data-close] buttons and backdrop clicks close the dialog
        document.addEventListener("click", (e) => {
            const closer = e.target.closest("[data-close]");
            if (closer) closer.closest("dialog").close();
        });
        document.querySelectorAll("dialog").forEach(dialog => {
            dialog.addEventListener("click", (e) => {
                if (e.target === dialog) dialog.close();
            });
        });

        // Context menu: keyboard navigation and anchor state
        const menu = $("contextMenu");
        menu.addEventListener("toggle", (e) => {
            if (e.newState === "closed" && this.menuAnchor) {
                this.menuAnchor.setAttribute("aria-expanded", "false");
                this.lastMenuAnchor = this.menuAnchor;
                this.menuClosedAt = performance.now();
                this.menuAnchor = null;
            }
        });
        menu.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...menu.querySelectorAll(".menu-item:not([disabled])")];
            const index = items.indexOf(document.activeElement);
            const next = (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next].focus();
        });

        // "/" focuses search
        document.addEventListener("keydown", (e) => {
            const typing = e.target.closest("input, select, textarea");
            if (e.key === "/" && !typing && this.isAuthenticated && !document.querySelector("dialog[open]")) {
                e.preventDefault();
                $("searchInput").focus();
            }
        });

        this.bindDragAndDrop();
    }

    // ===============================
    // Lock screen & authentication
    // ===============================

    async showLockScreen() {
        const hasAuth = await this.cryptoManager.isPasswordAuthSetup();
        $("app").hidden = true;
        $("lockScreen").hidden = false;
        $("unlockForm").hidden = !hasAuth;
        $("setupForm").hidden = hasAuth;
        (hasAuth ? $("masterPassword") : $("newMasterPassword")).focus();
    }

    async handleUnlock(event) {
        event.preventDefault();
        const input = $("masterPassword");
        const password = input.value.trim();
        if (!password) {
            this.showToast("Please enter your PIN/password", "error");
            return;
        }

        await this.withBusy(event.target, async () => {
            try {
                const success = await this.cryptoManager.authenticateWithPassword(password);
                input.value = "";
                if (success) {
                    await this.unlock(password);
                } else {
                    this.showToast("Invalid PIN/password", "error");
                    input.focus();
                }
            } catch (error) {
                input.value = "";
                this.showAuthError(error);
                input.focus();
            }
        });
    }

    async handleSetup(event) {
        event.preventDefault();
        const pin = $("newMasterPassword").value.trim();
        const confirmPin = $("confirmMasterPassword").value.trim();

        if (pin.length < PopupManager.MIN_PIN_LENGTH) {
            this.showToast(`PIN/Password must be at least ${PopupManager.MIN_PIN_LENGTH} characters`, "error");
            return;
        }
        if (pin !== confirmPin) {
            this.showToast("PINs do not match", "error");
            return;
        }

        await this.withBusy(event.target, async () => {
            if (await this.cryptoManager.setupPasswordAuth(pin)) {
                $("newMasterPassword").value = "";
                $("confirmMasterPassword").value = "";
                await this.unlock(pin);
                this.showToast("PIN created. Add your first account.", "success");
            } else {
                this.showToast("Failed to setup authentication", "error");
            }
        });
    }

    async openWindowFromLock() {
        const password = $("masterPassword").value.trim();
        if (!password) {
            this.openInNewWindow();
            return;
        }
        try {
            // Throwaway manager: this popup closes, the new window derives its own key
            if (await new CryptoManager().authenticateWithPassword(password)) {
                // One-shot hand-off, read and deleted by the new window within seconds
                await chrome.storage.session.set({
                    twinkey_handoff: { password: password, expiresAt: Date.now() + 10000 }
                });
                this.openInNewWindow();
                window.close();
            } else {
                $("masterPassword").value = "";
                this.showToast("Invalid PIN/password", "error");
            }
        } catch (error) {
            this.showAuthError(error);
        }
    }

    showAuthError(error) {
        if (error && error.retryAfterMs) {
            const seconds = Math.ceil(error.retryAfterMs / 1000);
            this.showToast(`Too many failed attempts. Try again in ${seconds} s`, "error");
        } else {
            console.error("Password auth error:", error);
            this.showToast("Authentication failed", "error");
        }
    }

    /**
     * One-time vault maintenance after a successful unlock. Failures are logged, never block access.
     */
    async afterUnlock(password) {
        try {
            await this.storageManager.migratePlaintextSecrets();
            if (this.cryptoManager.needsKdfUpgrade()) {
                await this.storageManager.rekeyVault(password);
            }
        } catch (error) {
            console.error("Vault upgrade skipped:", error);
        }
    }

    async unlock(password) {
        this.isAuthenticated = true;
        await this.afterUnlock(password);
        await this.loadData();
        $("lockScreen").hidden = true;
        $("app").hidden = false;
        this.render();
        this.startTicker();
        this.startActivityTracking();
        this.toggleWeakPinBanner(password.length < PopupManager.MIN_PIN_LENGTH);
    }

    lockApp() {
        if (!this.isAuthenticated) return;

        this.isAuthenticated = false;
        this.cryptoManager.logout();
        this.storageManager.clearSecretCache();

        // Stop code generation and wipe everything rendered from the vault
        clearInterval(this.ticker);
        clearTimeout(this.inactivityTimer);
        this.ticker = null;
        this.lastCounter = null;
        this.accounts = [];
        this.filteredAccounts = [];
        this.folders = [];
        ["accountsGrid", "folderList", "folderSelect", "accountFolder"].forEach(id => $(id).replaceChildren());
        document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
        if ($("contextMenu").matches(":popover-open")) $("contextMenu").hidePopover();
        document.querySelectorAll('input[type="password"], #accountForm input, #importFile').forEach(input => { input.value = ""; });

        this.showLockScreen();
        this.showToast("Locked after 1 minute of inactivity");
    }

    startActivityTracking() {
        if (!this.activityBound) {
            this.activityBound = true;
            const reset = () => this.resetInactivityTimer();
            ["pointerdown", "pointermove", "keydown", "wheel"].forEach(event => {
                document.addEventListener(event, reset, { passive: true });
            });
        }
        this.resetInactivityTimer();
    }

    resetInactivityTimer() {
        clearTimeout(this.inactivityTimer);
        if (this.isAuthenticated) {
            this.inactivityTimer = setTimeout(() => this.lockApp(), PopupManager.INACTIVITY_TIMEOUT_MS);
        }
    }

    toggleWeakPinBanner(show) {
        $("weakPinBanner").hidden = !show;
    }

    async withBusy(form, task) {
        const buttons = form.querySelectorAll("button");
        buttons.forEach(button => { button.disabled = true; });
        form.setAttribute("aria-busy", "true");
        try {
            return await task();
        } finally {
            buttons.forEach(button => { button.disabled = false; });
            form.removeAttribute("aria-busy");
        }
    }

    // ===============================
    // Data
    // ===============================

    async loadData() {
        this.accounts = await this.storageManager.getAccounts();
        this.folders = await this.storageManager.getFolders();

        // Custom order needs unique sortOrder values (imports/merges may collide): renumber in one write
        const orders = this.accounts.map(account => account.sortOrder);
        const unique = new Set(orders);
        if (orders.some(order => !Number.isFinite(order)) || unique.size !== orders.length) {
            [...this.accounts]
                .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || String(a.createdAt).localeCompare(String(b.createdAt)))
                .forEach((account, index) => { account.sortOrder = index; });
            await this.storageManager.saveAccounts(this.accounts);
        }

        const folderExists = this.folders.some(folder => folder.id === this.currentFolderId);
        if (this.currentFolderId !== "all" && this.currentFolderId !== "uncategorized" && !folderExists) {
            this.currentFolderId = "all";
        }
    }

    filterAndSortAccounts() {
        let filtered = this.currentFolderId === "all"
            ? [...this.accounts]
            : this.accounts.filter(account => (account.folderId || "uncategorized") === this.currentFolderId);

        const term = this.searchQuery.toLowerCase();
        if (term) {
            filtered = filtered.filter(account =>
                [account.name, account.service, account.email].some(field => (field || "").toLowerCase().includes(term))
            );
        }

        const byText = field => (a, b) => (a[field] || "").localeCompare(b[field] || "");
        const sorters = {
            name: byText("name"),
            service: byText("service"),
            created: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            lastUsed: (a, b) => (b.lastUsed ? Date.parse(b.lastUsed) : 0) - (a.lastUsed ? Date.parse(a.lastUsed) : 0),
            custom: (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        };
        filtered.sort(sorters[this.sortBy] || sorters.custom);
        this.filteredAccounts = filtered;
    }

    canReorder() {
        return this.sortBy === "custom" && !this.searchQuery;
    }

    folderEntries() {
        const counts = {};
        this.accounts.forEach(account => {
            const id = account.folderId || "uncategorized";
            counts[id] = (counts[id] || 0) + 1;
        });
        return [
            { id: "all", name: "All accounts", icon: "layers", count: this.accounts.length, fixed: true },
            { id: "uncategorized", name: "Uncategorized", icon: "folder", count: counts.uncategorized || 0, fixed: true },
            ...this.folders
                .filter(folder => folder.id !== "uncategorized")
                .map(folder => ({
                    id: folder.id,
                    name: folder.name,
                    icon: (FOLDER_ICONS[folder.icon] || FOLDER_ICONS["bi-folder"])[0],
                    count: counts[folder.id] || 0,
                    fixed: false,
                    folder: folder
                }))
        ];
    }

    // ===============================
    // Rendering
    // ===============================

    render() {
        this.renderFolders();
        this.renderAccounts();
    }

    renderFolders() {
        const entries = this.folderEntries();
        $("folderList").replaceChildren(...entries.map(entry => this.buildFolderRow(entry)));
        $("folderSelect").replaceChildren(...entries.map(entry =>
            h("option", { value: entry.id, selected: entry.id === this.currentFolderId }, `${entry.name} (${entry.count})`)
        ));
        const current = entries.find(entry => entry.id === this.currentFolderId) || entries[0];
        $("currentFolderName").textContent = current.name;
    }

    buildFolderRow(entry) {
        const active = entry.id === this.currentFolderId;
        const row = h("li", { class: `folder-row${active ? " active" : ""}${entry.fixed ? " is-default" : ""}`, dataset: { folderId: entry.id } },
            h("button", { type: "button", class: "folder-btn", "aria-current": active ? "true" : null, on: { click: () => this.selectFolder(entry.id) } },
                icon(entry.icon),
                h("span", { class: "folder-name" }, entry.name),
                h("span", { class: "folder-count" }, String(entry.count))
            ),
            entry.fixed ? null : h("button", {
                type: "button",
                class: "icon-btn icon-btn-sm folder-more",
                "aria-label": `Options for ${entry.name}`,
                "aria-haspopup": "menu",
                "aria-expanded": "false",
                on: { click: (e) => this.openMenu(e.currentTarget, [
                    { label: "Rename", icon: "pencil", action: () => this.openFolderDialog(entry.folder) },
                    { separator: true },
                    { label: "Delete folder", icon: "trash", danger: true, action: () => this.deleteFolder(entry.folder) }
                ]) }
            }, icon("more"))
        );

        if (entry.id !== "all") {
            row.addEventListener("dragover", (e) => {
                if (!this.draggedCard) return;
                e.preventDefault();
                row.classList.add("drop-target");
            });
            row.addEventListener("dragleave", (e) => {
                if (!row.contains(e.relatedTarget)) row.classList.remove("drop-target");
            });
            row.addEventListener("drop", (e) => {
                if (!this.draggedCard) return;
                e.preventDefault();
                const accountId = this.draggedCard.dataset.accountId;
                this.endDrag();
                this.moveAccountToFolder(accountId, entry.id);
            });
        }
        return row;
    }

    selectFolder(folderId) {
        this.currentFolderId = folderId;
        this.render();
    }

    renderAccounts() {
        this.filterAndSortAccounts();
        const grid = $("accountsGrid");
        const empty = $("emptyState");
        $("accountCount").textContent = this.filteredAccounts.length ? String(this.filteredAccounts.length) : "";

        if (!this.filteredAccounts.length) {
            grid.replaceChildren();
            grid.hidden = true;
            empty.hidden = false;
            const noAccounts = this.accounts.length === 0;
            $("emptyTitle").textContent = noAccounts ? t("no_accounts") : this.searchQuery ? "No matches" : "This folder is empty";
            $("emptyText").textContent = noAccounts
                ? "Add the secret key from a service's 2FA setup page."
                : this.searchQuery ? `Nothing matches “${this.searchQuery}”.` : "Drag accounts onto this folder, or add a new one.";
            $("emptyAddBtn").hidden = !!this.searchQuery;
            return;
        }

        empty.hidden = true;
        grid.hidden = false;
        const canReorder = this.canReorder();
        grid.replaceChildren(...this.filteredAccounts.map(account => this.buildCard(account, canReorder)));
        this.refreshCodes();
    }

    buildCard(account, canReorder) {
        const label = !account.service || account.service === "Other" ? account.name : account.service;
        const folder = this.currentFolderId === "all" && account.folderId && account.folderId !== "uncategorized"
            ? this.folders.find(item => item.id === account.folderId)
            : null;
        const subtitle = [account.service, account.email, folder && folder.name].filter(Boolean).join(" · ");

        const avatar = h("span", { class: "avatar", "aria-hidden": "true" }, (Array.from(label || "?")[0] || "?").toUpperCase());
        avatar.style.setProperty("--hue", hueFor(label));

        const codeButton = h("button", {
            type: "button",
            class: "code-btn",
            "aria-label": `Copy code for ${account.name}`,
            on: { click: () => this.copyOTP(account, codeButton) }
        }, h("span", { class: "code-digits" }, "••• •••"), icon("copy", "icon code-icon"));

        return h("article", { class: "card", dataset: { accountId: account.id } },
            h("div", { class: "card-head" },
                avatar,
                h("div", { class: "card-meta" },
                    h("div", { class: "card-name", title: account.name }, account.name),
                    h("div", { class: "card-sub", title: subtitle }, subtitle)
                ),
                h("div", { class: "card-actions" },
                    canReorder ? h("span", { class: "icon-btn icon-btn-sm grip", draggable: "true", title: "Drag to reorder or onto a folder" }, icon("grip")) : null,
                    h("button", {
                        type: "button",
                        class: "icon-btn icon-btn-sm",
                        "aria-label": `Options for ${account.name}`,
                        "aria-haspopup": "menu",
                        "aria-expanded": "false",
                        on: { click: (e) => this.openAccountMenu(e.currentTarget, account) }
                    }, icon("more"))
                )
            ),
            codeButton
        );
    }

    cardFor(accountId) {
        return $("accountsGrid").querySelector(`[data-account-id="${CSS.escape(accountId)}"]`);
    }

    async refreshCodes() {
        const cards = [...$("accountsGrid").querySelectorAll(".card")];
        await Promise.all(cards.map(async (card) => {
            const account = this.accounts.find(item => item.id === card.dataset.accountId);
            if (!account) return;
            const code = await this.generateOTP(account);
            const digits = card.querySelector(".code-digits");
            const valid = this.isCode(code);
            digits.textContent = valid ? this.formatOTP(code) : code === PopupManager.CODE_LOCKED ? "Can't decrypt" : "Invalid secret";
            digits.classList.toggle("is-marker", !valid);
        }));
    }

    // ===============================
    // Codes
    // ===============================

    /**
     * Current code for an account, or a CODE_* marker when it cannot be produced.
     */
    async generateOTP(account) {
        const secret = await this.storageManager.decryptAccountSecret(account);
        if (!secret) return PopupManager.CODE_LOCKED;
        return (await this.totpGenerator.generate(secret)) || PopupManager.CODE_INVALID;
    }

    isCode(value) {
        return /^\d{6}$/.test(value);
    }

    formatOTP(otp) {
        return this.isCode(otp) ? otp.replace(/(\d{3})(\d{3})/, "$1 $2") : otp;
    }

    startTicker() {
        clearInterval(this.ticker);
        this.lastCounter = Math.floor(Date.now() / 30000);
        this.tick(true);
        this.ticker = setInterval(() => this.tick(), 1000);
    }

    tick(initial = false) {
        const now = Date.now();
        const remaining = 30 - (Math.floor(now / 1000) % 30);
        const bar = $("countdownBar");
        // Jump (no animation) when a new period starts
        bar.classList.toggle("no-anim", initial || remaining === 30);
        bar.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - remaining / 30));
        $("countdownText").textContent = String(remaining);
        $("app").classList.toggle("expiring", remaining <= 5);

        // Regenerate when the 30 s period changes (robust to late ticks and sleep)
        const counter = Math.floor(now / 30000);
        if (counter !== this.lastCounter) {
            this.lastCounter = counter;
            this.refreshCodes();
        }
    }

    async copyOTP(account, button = null) {
        const otp = await this.generateOTP(account);
        if (!this.isCode(otp)) {
            this.showToast(otp === PopupManager.CODE_LOCKED ? "This account's secret can't be decrypted" : "Invalid secret key for this account", "error");
            return;
        }

        try {
            await navigator.clipboard.writeText(otp);
        } catch (error) {
            console.error("Error copying OTP:", error);
            this.showToast(t("error_copying_code"), "error");
            return;
        }
        this.showToast(t("success_account_copied", { name: account.name }), "success");

        const target = button || this.cardFor(account.id)?.querySelector(".code-btn");
        if (target) {
            const use = target.querySelector(".code-icon use");
            target.classList.add("copied");
            use.setAttribute("href", "#i-check");
            setTimeout(() => {
                target.classList.remove("copied");
                use.setAttribute("href", "#i-copy");
            }, 1200);
        }

        account.lastUsed = new Date().toISOString();
        await this.storageManager.updateAccount(account.id, { lastUsed: account.lastUsed });
    }

    // ===============================
    // Context menu
    // ===============================

    openAccountMenu(anchor, account) {
        const items = [
            { label: "Copy code", icon: "copy", action: () => this.copyOTP(account) },
            { label: t("edit"), icon: "pencil", action: () => this.openAccountDialog(account) }
        ];
        if (this.canReorder()) {
            const index = this.filteredAccounts.findIndex(item => item.id === account.id);
            items.push(
                { separator: true },
                { label: "Move up", icon: "up", disabled: index <= 0, action: () => this.moveAccount(account.id, -1) },
                { label: "Move down", icon: "down", disabled: index >= this.filteredAccounts.length - 1, action: () => this.moveAccount(account.id, 1) }
            );
        }
        items.push({ separator: true }, { label: t("delete"), icon: "trash", danger: true, action: () => this.deleteAccount(account) });
        this.openMenu(anchor, items);
    }

    openMenu(anchor, items) {
        const menu = $("contextMenu");
        // Clicking the anchor of the menu that light-dismiss just closed should not reopen it
        if (this.lastMenuAnchor === anchor && performance.now() - this.menuClosedAt < 300) return;

        menu.replaceChildren(...items.map(item => item.separator
            ? h("div", { class: "menu-sep", role: "separator" })
            : h("button", {
                type: "button",
                class: `menu-item${item.danger ? " danger" : ""}`,
                role: "menuitem",
                disabled: !!item.disabled,
                on: { click: () => { menu.hidePopover(); item.action(); } }
            }, icon(item.icon), item.label)
        ));

        this.menuAnchor = anchor;
        anchor.setAttribute("aria-expanded", "true");
        menu.showPopover();

        const rect = anchor.getBoundingClientRect();
        const left = Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8));
        let top = rect.bottom + 4;
        if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menu.offsetHeight - 4);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.querySelector(".menu-item:not([disabled])")?.focus();
    }

    confirmAction({ title, message, confirmLabel = "Delete", danger = true }) {
        const dialog = $("confirmDialog");
        $("confirmTitle").textContent = title;
        $("confirmMessage").textContent = message;
        const ok = $("confirmOkBtn");
        ok.textContent = confirmLabel;
        ok.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
        dialog.returnValue = "";
        dialog.showModal();
        return new Promise(resolve => {
            dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
        });
    }

    // ===============================
    // Accounts
    // ===============================

    fillFolderSelect(select, selectedId) {
        const options = [h("option", { value: "uncategorized" }, "Uncategorized")];
        this.folders.filter(folder => folder.id !== "uncategorized").forEach(folder => {
            options.push(h("option", { value: folder.id }, folder.name));
        });
        select.replaceChildren(...options);
        select.value = this.folders.some(folder => folder.id === selectedId) ? selectedId : "uncategorized";
    }

    openAccountDialog(account = null) {
        this.editingAccountId = account ? account.id : null;
        $("accountDialogTitle").textContent = account ? "Edit account" : "Add account";
        $("accountSubmitBtn").textContent = account ? "Save changes" : "Add account";
        $("secretField").hidden = !!account;
        $("accountName").value = account ? account.name : "";
        $("accountEmail").value = account ? account.email || "" : "";
        $("secretKey").value = "";

        // Imported accounts may use a service outside the list: show it as an extra option
        const service = $("serviceName");
        service.querySelectorAll(".extra-option").forEach(option => option.remove());
        const value = account ? account.service || "Other" : "Google";
        if (![...service.options].some(option => option.value === value)) {
            service.append(h("option", { value: value, class: "extra-option" }, value));
        }
        service.value = value;

        const defaultFolder = this.currentFolderId === "all" ? "uncategorized" : this.currentFolderId;
        this.fillFolderSelect($("accountFolder"), account ? account.folderId : defaultFolder);

        $("accountDialog").showModal();
        $("accountName").focus();
    }

    async handleAccountSubmit(event) {
        event.preventDefault();
        const data = {
            name: $("accountName").value.trim(),
            service: $("serviceName").value,
            email: $("accountEmail").value.trim(),
            folderId: $("accountFolder").value
        };

        if (!data.name) {
            this.showToast("Please enter an account name", "error");
            $("accountName").focus();
            return;
        }

        if (this.editingAccountId) {
            if (!await this.storageManager.updateAccount(this.editingAccountId, data)) {
                this.showToast("Failed to update account", "error");
                return;
            }
            this.showToast("Account updated", "success");
        } else {
            const secret = $("secretKey").value.replace(/[\s-]/g, "").toUpperCase();
            // Base32, optional "=" padding — same rule as import
            if (!StorageManager.BASE32_PATTERN.test(secret)) {
                this.showToast(t("error_invalid_secret"), "error");
                $("secretKey").focus();
                return;
            }
            const id = await this.storageManager.addAccount({ ...data, secret, createdAt: new Date().toISOString(), lastUsed: null });
            $("secretKey").value = "";
            if (!id) {
                this.showToast(t("error_adding_account"), "error");
                return;
            }
            this.showToast(t("success_account_added"), "success");
        }

        // Reload from storage so no plaintext secret is kept in memory
        this.accounts = await this.storageManager.getAccounts();
        $("accountDialog").close();
        this.render();
    }

    async deleteAccount(account) {
        const confirmed = await this.confirmAction({
            title: `Delete “${account.name}”?`,
            message: "You will lose access to its codes unless you have the secret key elsewhere. This cannot be undone."
        });
        if (!confirmed) return;

        if (await this.storageManager.deleteAccount(account.id)) {
            this.accounts = await this.storageManager.getAccounts();
            this.render();
            this.showToast("Account deleted", "success");
        } else {
            this.showToast("Failed to delete account", "error");
        }
    }

    async moveAccount(accountId, delta) {
        const ids = this.filteredAccounts.map(account => account.id);
        const index = ids.indexOf(accountId);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        await this.saveOrder(ids);
        this.renderAccounts();
        this.cardFor(accountId)?.querySelector(".card-actions button")?.focus();
    }

    /**
     * Persist a new order for the visible accounts by reusing their existing sortOrder slots,
     * so accounts hidden by the folder filter keep their positions.
     */
    async saveOrder(orderedIds) {
        const stored = await this.storageManager.getAccounts();
        const byId = new Map(stored.map(account => [account.id, account]));
        const visible = orderedIds.map(id => byId.get(id)).filter(Boolean);
        const slots = visible.map(account => account.sortOrder).sort((a, b) => a - b);
        visible.forEach((account, index) => { account.sortOrder = slots[index]; });
        await this.storageManager.saveAccounts(stored);
        this.accounts = stored;
    }

    async moveAccountToFolder(accountId, folderId) {
        const account = this.accounts.find(item => item.id === accountId);
        if (!account || (account.folderId || "uncategorized") === folderId) {
            this.renderAccounts();
            return;
        }
        if (await this.storageManager.updateAccount(accountId, { folderId: folderId })) {
            this.accounts = await this.storageManager.getAccounts();
            this.render();
            const entry = this.folderEntries().find(item => item.id === folderId);
            this.showToast(`Moved to ${entry ? entry.name : "folder"}`, "success");
        } else {
            this.showToast("Failed to move account", "error");
        }
    }

    // ===============================
    // Drag & drop (grip handle → reorder in grid, or drop on a folder)
    // ===============================

    bindDragAndDrop() {
        const grid = $("accountsGrid");

        grid.addEventListener("dragstart", (e) => {
            const grip = e.target.closest && e.target.closest(".grip");
            if (!grip) return;
            const card = grip.closest(".card");
            this.draggedCard = card;
            this.dragOrigin = this.visibleOrder();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", card.dataset.accountId);
            const rect = card.getBoundingClientRect();
            e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
            requestAnimationFrame(() => card.classList.add("dragging"));
        });

        grid.addEventListener("dragover", (e) => {
            if (!this.draggedCard) return;
            e.preventDefault();
            const target = e.target.closest(".card");
            if (!target || target === this.draggedCard) return;
            const rect = target.getBoundingClientRect();
            const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
            const after = columns > 1 ? e.clientX > rect.left + rect.width / 2 : e.clientY > rect.top + rect.height / 2;
            const reference = after ? target.nextSibling : target;
            if (reference !== this.draggedCard) grid.insertBefore(this.draggedCard, reference);
        });

        grid.addEventListener("drop", (e) => {
            if (this.draggedCard) e.preventDefault();
        });

        grid.addEventListener("dragend", async () => {
            if (!this.draggedCard) return;
            const origin = this.dragOrigin;
            this.endDrag();
            const order = this.visibleOrder();
            if (order.join() !== origin.join()) {
                await this.saveOrder(order);
                this.filterAndSortAccounts();
            }
        });
    }

    endDrag() {
        if (this.draggedCard) this.draggedCard.classList.remove("dragging");
        this.draggedCard = null;
        document.querySelectorAll(".drop-target").forEach(el => el.classList.remove("drop-target"));
    }

    visibleOrder() {
        return [...$("accountsGrid").querySelectorAll(".card")].map(card => card.dataset.accountId);
    }

    // ===============================
    // Folders
    // ===============================

    buildIconPicker() {
        $("folderIconPicker").replaceChildren(...Object.entries(FOLDER_ICONS).flatMap(([value, [sprite, label]], index) => [
            h("input", { type: "radio", name: "folderIcon", id: `folderIcon${index}`, value: value }),
            h("label", { for: `folderIcon${index}`, title: label, "aria-label": label }, icon(sprite))
        ]));
    }

    openFolderDialog(folder = null) {
        this.editingFolderId = folder ? folder.id : null;
        $("folderDialogTitle").textContent = folder ? "Rename folder" : "New folder";
        $("folderSubmitBtn").textContent = folder ? "Save" : "Create folder";
        $("folderName").value = folder ? folder.name : "";
        const iconValue = folder && FOLDER_ICONS[folder.icon] ? folder.icon : "bi-folder";
        document.querySelector(`input[name="folderIcon"][value="${iconValue}"]`).checked = true;
        $("folderDialog").showModal();
        $("folderName").focus();
    }

    async handleFolderSubmit(event) {
        event.preventDefault();
        const name = $("folderName").value.trim();
        const iconValue = document.querySelector('input[name="folderIcon"]:checked').value;
        if (!name) {
            this.showToast("Please enter folder name", "error");
            $("folderName").focus();
            return;
        }

        const success = this.editingFolderId
            ? await this.storageManager.updateFolder(this.editingFolderId, { name: name, icon: iconValue })
            : await this.storageManager.addFolder({ name: name, icon: iconValue, createdAt: new Date().toISOString() });
        if (!success) {
            this.showToast("Failed to save folder", "error");
            return;
        }

        this.folders = await this.storageManager.getFolders();
        $("folderDialog").close();
        this.render();
        this.showToast(this.editingFolderId ? "Folder updated" : "Folder created", "success");
    }

    async deleteFolder(folder) {
        const count = this.accounts.filter(account => account.folderId === folder.id).length;
        const confirmed = await this.confirmAction({
            title: `Delete “${folder.name}”?`,
            message: count ? `${count} account(s) in this folder will move to Uncategorized.` : "The folder is empty.",
            confirmLabel: "Delete folder"
        });
        if (!confirmed) return;

        // Storage moves the folder's accounts to Uncategorized
        if (await this.storageManager.deleteFolder(folder.id)) {
            this.accounts = await this.storageManager.getAccounts();
            this.folders = await this.storageManager.getFolders();
            if (this.currentFolderId === folder.id) this.currentFolderId = "all";
            this.render();
            this.showToast("Folder deleted", "success");
        } else {
            this.showToast("Failed to delete folder", "error");
        }
    }

    // ===============================
    // Window & theme
    // ===============================

    openInNewWindow() {
        const width = 1100;
        const height = 760;
        const left = Math.round((screen.availWidth - width) / 2);
        const top = Math.round((screen.availHeight - height) / 2);
        if (typeof chrome !== "undefined" && chrome.windows) {
            chrome.windows.create({ url: chrome.runtime.getURL("popup.html?window=1"), type: "popup", width, height, left, top, focused: true });
        } else {
            window.open("popup.html?window=1", "TwinKey", `width=${width},height=${height},left=${left},top=${top}`);
        }
    }

    applyTheme(theme) {
        if (theme === "light" || theme === "dark") {
            document.documentElement.dataset.theme = theme;
        } else {
            delete document.documentElement.dataset.theme;
        }
    }

    async saveTheme(theme) {
        this.settings = { ...((await this.storageManager.getSettings()) || {}), appearance: theme };
        await this.storageManager.saveSettings(this.settings);
        this.applyTheme(theme);
    }

    // ===============================
    // Settings: PIN, export, import, stats
    // ===============================

    openSettings() {
        const theme = this.settings.appearance || "auto";
        const radio = document.querySelector(`input[name="theme"][value="${theme === "light" || theme === "dark" ? theme : "auto"}"]`);
        radio.checked = true;
        $("importFile").value = "";
        $("importPassword").value = "";
        $("importPasswordSection").hidden = true;
        $("importBtn").disabled = true;
        this.updateSettingsStats();
        $("settingsDialog").showModal();
    }

    async updateSettingsStats() {
        $("statsAccounts").textContent = String(this.accounts.length);
        $("statsFolders").textContent = String(this.folders.filter(folder => folder.id !== "uncategorized").length);
        const bytes = await this.storageManager.getStorageBytes();
        $("statsStorage").textContent = `${Math.round(bytes / 1024 * 10) / 10} KB`;
    }

    async handleChangePin(event) {
        event.preventDefault();
        const currentInput = $("currentPin");
        const newInput = $("newPin");
        const confirmInput = $("confirmNewPin");
        const newPin = newInput.value;

        if (newPin.length < PopupManager.MIN_PIN_LENGTH) {
            this.showToast(`New PIN must be at least ${PopupManager.MIN_PIN_LENGTH} characters`, "error");
            return;
        }
        if (newPin !== confirmInput.value) {
            this.showToast("New PINs do not match", "error");
            return;
        }

        await this.withBusy(event.target, async () => {
            try {
                // Verify the current PIN on a throwaway manager (counts toward lockout)
                if (!await new CryptoManager().authenticateWithPassword(currentInput.value)) {
                    this.showToast("Current PIN is incorrect", "error");
                    return;
                }
                await this.storageManager.rekeyVault(newPin);
                // Every ciphertext changed: drop cached plaintexts and reload, or uncached accounts can't decrypt
                this.storageManager.clearSecretCache();
                this.accounts = await this.storageManager.getAccounts();
                this.render();
                [currentInput, newInput, confirmInput].forEach(input => { input.value = ""; });
                this.toggleWeakPinBanner(false);
                this.showToast("PIN changed successfully", "success");
            } catch (error) {
                if (error.retryAfterMs) {
                    this.showAuthError(error);
                } else {
                    console.error("Change PIN error:", error);
                    this.showToast(error.message || "Failed to change PIN", "error");
                }
            }
        });
    }

    openExportDialog() {
        $("exportEncrypted").checked = true;
        $("exportPassword").value = "";
        $("exportPasswordConfirm").value = "";
        $("exportPasswordSection").hidden = false;
        $("exportDialog").showModal();
        $("exportPassword").focus();
    }

    async handleExport(event) {
        event.preventDefault();
        const encrypted = $("exportEncrypted").checked;
        const password = $("exportPassword").value;

        // The file is portable, so its password must resist offline guessing
        if (encrypted) {
            if (password.length < 8) {
                this.showToast("Please enter a password (at least 8 characters)", "error");
                return;
            }
            if (password !== $("exportPasswordConfirm").value) {
                this.showToast("Passwords do not match", "error");
                return;
            }
        }

        await this.withBusy(event.target, async () => {
            const result = await this.storageManager.exportData(encrypted ? password : null);
            if (!result) {
                this.showToast("Error exporting data", "error");
                return;
            }

            const date = new Date().toISOString().slice(0, 10);
            const filename = `twinkey-backup-${date}${encrypted ? "-encrypted" : ""}.json`;
            const url = URL.createObjectURL(new Blob([JSON.stringify(result.file, null, 2)], { type: "application/json" }));
            const link = h("a", { href: url, download: filename });
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            $("exportPassword").value = "";
            $("exportPasswordConfirm").value = "";
            $("exportDialog").close();
            if (result.skipped > 0) {
                this.showToast(`Exported, but ${result.skipped} unreadable account(s) were left out`, "error");
            } else {
                this.showToast(encrypted ? "Backup exported with password protection" : "Backup exported without encryption", "success");
            }
        });
    }

    async handleFileSelection(event) {
        const file = event.target.files[0];
        $("importBtn").disabled = !file;
        $("importPasswordSection").hidden = true;
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            $("importPasswordSection").hidden = !(data && data.encrypted);
        } catch (error) {
            // Reported on import
        }
    }

    async handleImport(event) {
        event.preventDefault();
        const file = $("importFile").files[0];
        if (!file) {
            this.showToast("Please select a file", "error");
            return;
        }

        let data;
        try {
            data = JSON.parse(await file.text());
        } catch (error) {
            this.showToast("Invalid backup file format", "error");
            return;
        }

        const importPassword = data && data.encrypted ? $("importPassword").value : null;
        if (data && data.encrypted && !importPassword) {
            this.showToast("Please enter the import password", "error");
            $("importPassword").focus();
            return;
        }

        const mode = $("importModeMerge").checked ? "merge" : "replace";
        const confirmed = await this.confirmAction(mode === "merge"
            ? { title: "Merge backup?", message: "Accounts and folders from the file will be added. Items with the same ID will be overwritten.", confirmLabel: "Merge", danger: false }
            : { title: "Replace all data?", message: "All current accounts and folders will be replaced by the backup.", confirmLabel: "Replace" });
        if (!confirmed) return;

        await this.withBusy(event.target, async () => {
            try {
                // Throws with a user-facing message on wrong password or bad file
                const summary = await this.storageManager.importData(data, importPassword, mode);
                await this.loadData();
                this.render();
                $("settingsDialog").close();
                const skippedNote = summary.skipped > 0 ? `, ${summary.skipped} invalid item(s) skipped` : "";
                this.showToast(`Imported ${summary.accounts} account(s)${skippedNote}`, summary.skipped > 0 ? "error" : "success");
            } catch (error) {
                console.error("Error importing data:", error);
                this.showToast(error.message || "Error importing data", "error");
            }
        });
    }

    // ===============================
    // Toast
    // ===============================

    showToast(message, type = "info") {
        const toast = $("toast");
        toast.textContent = message;
        toast.className = `toast show${type === "error" ? " error" : ""}`;
        // A newer toast restarts the timer instead of being hidden by an older one
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
    }
}

// Shown in place of a code when the secret can't be decrypted / is not valid Base32
PopupManager.CODE_LOCKED = "LOCKED";
PopupManager.CODE_INVALID = "INVALID";
// Minimum length for a new master PIN/password (existing shorter PINs still unlock, with a warning)
PopupManager.MIN_PIN_LENGTH = 6;
PopupManager.INACTIVITY_TIMEOUT_MS = 60000;

document.addEventListener("DOMContentLoaded", () => {
    // Exposed for DevTools debugging and the headless smoke test
    window.popupManager = new PopupManager();
});
