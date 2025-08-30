// Crypto Manager for secure storage and biometric authentication

class CryptoManager {
    constructor() {
        this.isWebAuthnSupported = this.checkWebAuthnSupport();
        this.credentialId = null;
        this.encryptionKey = null;
    }

    /**
     * Check if Web Authentication API is supported
     */
    checkWebAuthnSupport() {
        // For Chrome extensions, we'll use system authentication
        return true; // Always return true, we'll handle the authentication differently
    }

    /**
     * Generate encryption key from user authentication
     */
    async generateEncryptionKey(password = null) {
        try {
            if (password) {
                return await this.setupPasswordAuth(password);
            }
            
            // Try authenticating with existing password
            return await this.authenticateWithPassword();
        } catch (error) {
            console.error("Error generating encryption key:", error);
            return false;
        }
    }

    /**
     * Setup password authentication with verification token
     */
    async setupPasswordAuth(password) {
        try {
            // Generate random verification token
            const verificationToken = crypto.randomUUID();
            
            // Create encryption key from password
            const encoder = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(password),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            const salt = new Uint8Array(16);
            window.crypto.getRandomValues(salt);
            
            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            // Encrypt the verification token with the password
            const encryptedToken = await this.encrypt(verificationToken);
            
            // Store salt and encrypted token for verification
            const isExtension = typeof chrome !== 'undefined' && chrome.storage;
            if (isExtension) {
                await chrome.storage.local.set({
                    'twinkey_salt': Array.from(salt).join(','),
                    'twinkey_verify_token': encryptedToken,
                    'twinkey_verify_plain': verificationToken
                });
            } else {
                localStorage.setItem('twinkey_salt', Array.from(salt).join(','));
                localStorage.setItem('twinkey_verify_token', encryptedToken);
                localStorage.setItem('twinkey_verify_plain', verificationToken);
            }
            
            return true;
        } catch (error) {
            console.error("Error setting up password auth:", error);
            return false;
        }
    }

    /**
     * Authenticate with password by verifying decryption
     */
    async authenticateWithPassword(password) {
        try {
            // Get stored salt and verification token
            let saltStr, encryptedToken, expectedToken;
            
            const isExtension = typeof chrome !== 'undefined' && chrome.storage;
            if (isExtension) {
                const result = await chrome.storage.local.get([
                    'twinkey_salt', 
                    'twinkey_verify_token', 
                    'twinkey_verify_plain'
                ]);
                saltStr = result.twinkey_salt;
                encryptedToken = result.twinkey_verify_token;
                expectedToken = result.twinkey_verify_plain;
            } else {
                saltStr = localStorage.getItem('twinkey_salt');
                encryptedToken = localStorage.getItem('twinkey_verify_token');
                expectedToken = localStorage.getItem('twinkey_verify_plain');
            }
            
            if (!saltStr || !encryptedToken || !expectedToken) {
                throw new Error("No authentication data found");
            }
            
            // Recreate encryption key from password
            const salt = new Uint8Array(saltStr.split(',').map(x => parseInt(x)));
            const encoder = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(password),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            // Try to decrypt the verification token
            try {
                const decryptedToken = await this.decrypt(encryptedToken);
                
                // Verify the decrypted token matches the expected token
                if (decryptedToken === expectedToken) {
                    return true;
                } else {
                    this.encryptionKey = null;
                    return false;
                }
            } catch (decryptError) {
                // Decryption failed = wrong password
                this.encryptionKey = null;
                return false;
            }
        } catch (error) {
            console.error("Error authenticating with password:", error);
            this.encryptionKey = null;
            return false;
        }
    }

    /**
     * Authenticate user with biometrics (WebAuthn)
     */
    async authenticateWithBiometrics() {
        try {
            // Check if we have existing credentials
            const storedCredId = localStorage.getItem('twinkey_cred_id');
            
            if (!storedCredId) {
                // First time setup - create new credential
                return await this.setupBiometricAuth();
            } else {
                // Authenticate with existing credential
                return await this.verifyBiometricAuth(storedCredId);
            }
        } catch (error) {
            console.error("Biometric authentication error:", error);
            throw new Error("Biometric authentication failed");
        }
    }

    /**
     * Setup system authentication (simplified for Chrome extensions)
     */
    async setupSystemAuth() {
        try {
            console.log("Setting up system authentication...");
            
            // Generate a consistent key based on browser/system info
            const keyData = await this.generateSystemKey();
            
            // Derive encryption key
            const encoder = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(keyData),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const salt = new Uint8Array(16);
            // Use consistent salt based on system info
            const systemInfo = navigator.userAgent + navigator.platform + (navigator.hardwareConcurrency || 4);
            const saltData = await window.crypto.subtle.digest('SHA-256', encoder.encode(systemInfo));
            salt.set(new Uint8Array(saltData.slice(0, 16)));
            
            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            // Store that system auth is set up
            localStorage.setItem('twinkey_system_auth', 'true');
            return true;
            
        } catch (error) {
            console.error("System auth setup error:", error);
            throw error;
        }
    }

    /**
     * Generate system-specific key data with user verification
     */
    async generateSystemKey() {
        // Request user's system password
        const password = prompt("Enter your system/computer password for secure authentication:");
        if (!password) {
            throw new Error("Password required for authentication");
        }
        
        // Use browser fingerprint + user password
        const fingerprint = [
            navigator.userAgent,
            navigator.platform,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 4
        ].join('|');
        
        // Combine fingerprint with user password for stronger security
        return fingerprint + '|' + password;
    }

    /**
     * Authenticate using system method
     */
    async authenticateWithSystem() {
        try {
            console.log("Authenticating with system...");
            
            // Check if system auth is set up
            if (!this.isSystemAuthSetup()) {
                throw new Error("System authentication not set up");
            }
            
            // Request the same password used during setup
            const keyData = await this.generateSystemKey();
            
            const encoder = new TextEncoder();
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                encoder.encode(keyData),
                'PBKDF2',
                false,
                ['deriveKey']
            );
            
            const salt = new Uint8Array(16);
            // Use same salt as setup
            const systemInfo = navigator.userAgent + navigator.platform + (navigator.hardwareConcurrency || 4);
            const saltData = await window.crypto.subtle.digest('SHA-256', encoder.encode(systemInfo));
            salt.set(new Uint8Array(saltData.slice(0, 16)));
            
            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
            
            return true;
            
        } catch (error) {
            console.error("System authentication error:", error);
            throw error;
        }
    }

    /**
     * Verify biometric authentication with existing credential
     */
    async verifyBiometricAuth(storedCredId) {
        try {
            const credId = new Uint8Array(storedCredId.split(',').map(x => parseInt(x)));
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: challenge,
                    allowCredentials: [{
                        id: credId,
                        type: "public-key"
                    }],
                    userVerification: "required",
                    timeout: 60000
                }
            });

            if (assertion) {
                this.credentialId = assertion.rawId;
                await this.deriveKeyFromCredential(assertion);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Verify biometric auth error:", error);
            throw error;
        }
    }

    /**
     * Derive encryption key from WebAuthn credential
     */
    async deriveKeyFromCredential(credential) {
        try {
            // Use credential response to derive a consistent key
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw',
                credential.response.clientDataJSON,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            const salt = new Uint8Array(16);
            // Use consistent salt based on credential ID
            const credIdArray = new Uint8Array(credential.rawId);
            for (let i = 0; i < 16; i++) {
                salt[i] = credIdArray[i % credIdArray.length];
            }

            this.encryptionKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            console.error("Error deriving key from credential:", error);
            throw error;
        }
    }

    /**
     * Encrypt secret data
     */
    async encrypt(data) {
        try {
            if (!this.encryptionKey) {
                throw new Error("No encryption key available");
            }

            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            
            const iv = new Uint8Array(12);
            window.crypto.getRandomValues(iv);

            const encrypted = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                dataBuffer
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode.apply(null, combined));
        } catch (error) {
            console.error("Encryption error:", error);
            throw error;
        }
    }

    /**
     * Decrypt secret data
     */
    async decrypt(encryptedData) {
        try {
            if (!this.encryptionKey) {
                throw new Error("No encryption key available");
            }

            // Convert from base64
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error("Decryption error:", error);
            throw error;
        }
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
        this.credentialId = null;
    }

    /**
     * Get supported authentication methods
     */
    getSupportedAuthMethods() {
        const methods = [];
        
        if (this.isWebAuthnSupported) {
            methods.push('biometric');
        }
        
        methods.push('password');
        
        return methods;
    }

    /**
     * Check if biometric auth is set up
     */
    isBiometricSetup() {
        return !!localStorage.getItem('twinkey_cred_id');
    }

    /**
     * Check if system auth is set up
     */
    async isSystemAuthSetup() {
        const isExtension = typeof chrome !== 'undefined' && chrome.storage;
        if (isExtension) {
            const result = await chrome.storage.local.get('twinkey_system_auth');
            return !!result.twinkey_system_auth;
        } else {
            return !!localStorage.getItem('twinkey_system_auth');
        }
    }

    /**
     * Check if password auth is set up
     */
    async isPasswordAuthSetup() {
        const isExtension = typeof chrome !== 'undefined' && chrome.storage;
        if (isExtension) {
            const result = await chrome.storage.local.get('twinkey_verify_token');
            return !!result.twinkey_verify_token;
        } else {
            return !!localStorage.getItem('twinkey_verify_token');
        }
    }

    /**
     * Remove biometric credentials
     */
    removeBiometricAuth() {
        localStorage.removeItem('twinkey_cred_id');
        this.credentialId = null;
    }
}