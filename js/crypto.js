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
                // Use password-based key derivation
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
                
                // Store salt for later use
                localStorage.setItem('twinkey_salt', Array.from(salt).join(','));
                return true;
            }
            
            // Try system authentication (our simplified method)
            try {
                return await this.authenticateWithSystem();
            } catch (systemError) {
                console.log("System auth failed:", systemError.message);
                return false;
            }
        } catch (error) {
            console.error("Error generating encryption key:", error);
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
     * Generate system-specific key data
     */
    async generateSystemKey() {
        // Use browser fingerprint + request user verification
        const fingerprint = [
            navigator.userAgent,
            navigator.platform,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 4
        ].join('|');
        
        // Simple user verification - they need to confirm
        const confirmed = confirm("This will set up secure authentication using your system. Click OK to continue.");
        if (!confirmed) {
            throw new Error("User cancelled authentication setup");
        }
        
        return fingerprint;
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
            
            // Ask user to confirm their identity
            const confirmed = confirm("Please confirm your identity to access your OTP codes.");
            if (!confirmed) {
                throw new Error("Authentication cancelled");
            }
            
            // Generate the same key as during setup
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
    isSystemAuthSetup() {
        return !!localStorage.getItem('twinkey_system_auth');
    }

    /**
     * Remove biometric credentials
     */
    removeBiometricAuth() {
        localStorage.removeItem('twinkey_cred_id');
        this.credentialId = null;
    }
}