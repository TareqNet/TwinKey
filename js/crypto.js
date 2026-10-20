// Crypto Manager: PIN-derived AES-256-GCM key, verifier and lockout

class CryptoManager {
    constructor() {
        this.encryptionKey = null;
        this.verifyTokenValue = null;
        this.kdfIterations = null;
    }

    /**
     * Derive an AES-256-GCM key from a password. Pure: never touches storage.
     * @param {string} password
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password, salt, iterations = CryptoManager.LEGACY_ITERATIONS) {
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    generateSalt() {
        return window.crypto.getRandomValues(new Uint8Array(16));
    }

    /**
     * Salt currently stored for the master PIN, or null.
     * @returns {Promise<Uint8Array|null>}
     */
    async getStoredSalt() {
        const { twinkey_salt: saltStr } = await this.storageGet(["twinkey_salt"]);
        return saltStr ? CryptoManager.saltFromString(String(saltStr)) : null;
    }

    static saltFromString(saltStr) {
        return new Uint8Array(saltStr.split(",").map(x => parseInt(x, 10)));
    }

    static saltToString(salt) {
        return Array.from(salt).join(",");
    }

    static bytesToBase64(bytes) {
        // Chunked to avoid "Maximum call stack size exceeded" on large payloads
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    }

    static base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // Storage helpers: chrome.storage.local in the extension, localStorage in plain-page dev mode
    async storageGet(keys) {
        if (typeof chrome !== "undefined" && chrome.storage) {
            return chrome.storage.local.get(keys);
        }
        const out = {};
        keys.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                try { out[key] = JSON.parse(raw); } catch (error) { out[key] = raw; }
            }
        });
        return out;
    }

    async storageSet(items) {
        if (typeof chrome !== "undefined" && chrome.storage) {
            return chrome.storage.local.set(items);
        }
        Object.entries(items).forEach(([key, value]) => {
            localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
        });
    }

    async storageRemove(keys) {
        if (typeof chrome !== "undefined" && chrome.storage) {
            return chrome.storage.local.remove(keys);
        }
        keys.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Setup password authentication with verification token (first run only)
     */
    async setupPasswordAuth(password) {
        try {
            const rekey = await this.buildRekey(password);
            this.encryptionKey = rekey.key;
            this.kdfIterations = rekey.iterations;
            await this.storageSet(rekey.items);
            // Verification is "token decrypts" (AES-GCM tag); no plaintext copy is kept
            await this.storageRemove(["twinkey_verify_plain"]);
            return true;
        } catch (error) {
            console.error("Error setting up password auth:", error);
            return false;
        }
    }

    /**
     * Derive a new key and verifier for a password without storing anything.
     * Reuses the current token value so a verifier written later always matches.
     * @param {string} password
     * @returns {Promise<{key: CryptoKey, iterations: number, items: Object}>}
     */
    async buildRekey(password) {
        const salt = this.generateSalt();
        const iterations = CryptoManager.CURRENT_ITERATIONS;
        const key = await this.deriveKey(password, salt, iterations);
        const token = this.verifyTokenValue || crypto.randomUUID();
        this.verifyTokenValue = token;
        return {
            key: key,
            iterations: iterations,
            items: {
                twinkey_salt: CryptoManager.saltToString(salt),
                twinkey_verify_token: await this.encryptWithKey(key, token),
                twinkey_kdf_iter: iterations
            }
        };
    }

    /**
     * Authenticate with password by verifying decryption.
     * @returns {Promise<boolean>} false on wrong password
     * @throws {Error} with retryAfterMs while locked out after repeated failures
     */
    async authenticateWithPassword(password) {
        const retryAfterMs = await this.getLockoutRemaining();
        if (retryAfterMs > 0) {
            const error = new Error("Too many failed attempts");
            error.retryAfterMs = retryAfterMs;
            throw error;
        }

        try {
            const result = await this.storageGet([
                "twinkey_salt", "twinkey_verify_token", "twinkey_verify_plain", "twinkey_kdf_iter"
            ]);
            if (!result.twinkey_salt || !result.twinkey_verify_token) {
                throw new Error("No authentication data found");
            }

            const iterations = Number.isInteger(result.twinkey_kdf_iter)
                ? result.twinkey_kdf_iter
                : CryptoManager.LEGACY_ITERATIONS;
            const key = await this.deriveKey(password, CryptoManager.saltFromString(result.twinkey_salt), iterations);

            let token;
            try {
                token = await this.decryptWithKey(key, result.twinkey_verify_token);
            } catch (decryptError) {
                // AES-GCM tag mismatch = wrong password
                await this.recordFailedAttempt();
                this.encryptionKey = null;
                return false;
            }
            // Legacy vaults also stored the token in plaintext; honor it while it exists
            if (result.twinkey_verify_plain && token !== result.twinkey_verify_plain) {
                await this.recordFailedAttempt();
                this.encryptionKey = null;
                return false;
            }

            this.encryptionKey = key;
            this.kdfIterations = iterations;
            this.verifyTokenValue = token;
            await this.storageRemove(["twinkey_auth_failures"]);
            return true;
        } catch (error) {
            console.error("Error authenticating with password:", error);
            this.encryptionKey = null;
            return false;
        }
    }

    needsKdfUpgrade() {
        return this.isAuthenticated() && this.kdfIterations < CryptoManager.CURRENT_ITERATIONS;
    }

    /**
     * Milliseconds until the next attempt is allowed (0 = allowed).
     */
    async getLockoutRemaining() {
        const { twinkey_auth_failures: failures } = await this.storageGet(["twinkey_auth_failures"]);
        if (!failures || !failures.lockedUntil) return 0;
        return Math.max(0, failures.lockedUntil - Date.now());
    }

    /**
     * After 5 failures: 30 s lockout, doubling per further failure, capped at 15 min.
     * ponytail: stored in chrome.storage.local — slows guessing in the UI, not an attacker with disk access (PBKDF2 cost covers that).
     */
    async recordFailedAttempt() {
        const { twinkey_auth_failures: previous } = await this.storageGet(["twinkey_auth_failures"]);
        const count = ((previous && previous.count) || 0) + 1;
        const lockMs = count >= CryptoManager.MAX_FREE_ATTEMPTS
            ? Math.min(30000 * 2 ** (count - CryptoManager.MAX_FREE_ATTEMPTS), 15 * 60 * 1000)
            : 0;
        await this.storageSet({
            twinkey_auth_failures: { count: count, lockedUntil: lockMs ? Date.now() + lockMs : 0 }
        });
    }

    /**
     * Encrypt secret data
     */
    async encrypt(data) {
        if (!this.encryptionKey) {
            throw new Error("No encryption key available");
        }
        return this.encryptWithKey(this.encryptionKey, data);
    }

    /**
     * Decrypt secret data
     */
    async decrypt(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error("No encryption key available");
        }
        return this.decryptWithKey(this.encryptionKey, encryptedData);
    }

    /**
     * AES-GCM encrypt with an explicit key. Output: base64(IV[12] + ciphertext).
     */
    async encryptWithKey(key, data) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            new TextEncoder().encode(data)
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        return CryptoManager.bytesToBase64(combined);
    }

    /**
     * AES-GCM decrypt with an explicit key. Throws on wrong key or tampered data.
     */
    async decryptWithKey(key, encryptedData) {
        const combined = CryptoManager.base64ToBytes(encryptedData);
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: combined.slice(0, 12) },
            key,
            combined.slice(12)
        );
        return new TextDecoder().decode(decrypted);
    }

    /**
     * Check if user is currently authenticated
     */
    isAuthenticated() {
        return this.encryptionKey !== null;
    }

    /**
     * Clear authentication state
     */
    logout() {
        this.encryptionKey = null;
        this.verifyTokenValue = null;
        this.kdfIterations = null;
    }

    /**
     * Check if password auth is set up
     */
    async isPasswordAuthSetup() {
        const result = await this.storageGet(["twinkey_verify_token"]);
        return !!result.twinkey_verify_token;
    }
}

// PBKDF2 iterations used by the vault before versioned KDF params existed
CryptoManager.LEGACY_ITERATIONS = 100000;
// Current vault PBKDF2 iterations (OWASP 2023 for PBKDF2-HMAC-SHA256); stored as twinkey_kdf_iter
CryptoManager.CURRENT_ITERATIONS = 600000;
// Failed PIN attempts allowed before lockout starts
CryptoManager.MAX_FREE_ATTEMPTS = 5;
// Export files are portable and exposed to offline brute force: use OWASP 2023 value
CryptoManager.EXPORT_ITERATIONS = 600000;