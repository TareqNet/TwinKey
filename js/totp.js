// TOTP (Time-based One-Time Password) Generator
// RFC 6238 compliant implementation using Web Crypto API

class TOTPGenerator {
    constructor() {
        this.timeStep = 30; // 30 seconds
        this.digits = 6; // 6 digit codes
    }

    /**
     * Generate TOTP code from secret key
     * @param {string} secret - Base32 encoded secret key
     * @param {number} timestamp - Optional timestamp (default: current time)
     * @returns {Promise<string>} 6-digit TOTP code
     */
    async generate(secret, timestamp = null) {
        try {
            // Use current time if not provided
            const time = timestamp || Math.floor(Date.now() / 1000);
            
            // Calculate time counter
            const counter = Math.floor(time / this.timeStep);
            
            // Decode base32 secret
            const key = this.base32Decode(secret.replace(/\s+/g, "").toUpperCase());
            
            // Convert counter to 8 bytes (big-endian)
            const counterBytes = new ArrayBuffer(8);
            const counterView = new DataView(counterBytes);
            counterView.setUint32(4, counter, false); // big-endian, high 32 bits are 0
            
            // Import key for HMAC-SHA1
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                key,
                { name: 'HMAC', hash: 'SHA-1' },
                false,
                ['sign']
            );
            
            // Generate HMAC
            const hmac = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
            const hmacBytes = new Uint8Array(hmac);
            
            // Apply dynamic truncation
            const offset = hmacBytes[19] & 0x0f;
            const code = ((hmacBytes[offset] & 0x7f) << 24) |
                        ((hmacBytes[offset + 1] & 0xff) << 16) |
                        ((hmacBytes[offset + 2] & 0xff) << 8) |
                        (hmacBytes[offset + 3] & 0xff);
            
            const otp = (code % 1000000).toString().padStart(6, '0');
            
            return otp;
        } catch (error) {
            console.error("Error generating TOTP:", error);
            return "000000";
        }
    }

    /**
     * Get remaining seconds until next code generation
     * @returns {number} Remaining seconds
     */
    getRemainingSeconds() {
        const now = Math.floor(Date.now() / 1000);
        return this.timeStep - (now % this.timeStep);
    }

    /**
     * Get progress percentage for countdown timer
     * @returns {number} Progress percentage (0-100)
     */
    getProgress() {
        const remaining = this.getRemainingSeconds();
        return ((this.timeStep - remaining) / this.timeStep) * 100;
    }

    /**
     * Validate secret key format
     * @param {string} secret - Secret key to validate
     * @returns {boolean} True if valid
     */
    validateSecret(secret) {
        if (!secret || typeof secret !== "string") {
            return false;
        }

        // Remove spaces and convert to uppercase
        const cleanSecret = secret.replace(/\s+/g, "").toUpperCase();
        
        // Check if it's valid base32 (A-Z, 2-7, =)
        const base32Regex = /^[A-Z2-7=]+$/;
        
        return base32Regex.test(cleanSecret) && cleanSecret.length >= 16;
    }

    /**
     * Decode base32 string to bytes - same as working version
     * @param {string} base32 - Base32 encoded string
     * @returns {Uint8Array} Decoded bytes
     */
    base32Decode(base32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        base32 = base32.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
        
        let bits = 0;
        let value = 0;
        const output = [];
        
        for (let i = 0; i < base32.length; i++) {
            const char = base32[i];
            const index = alphabet.indexOf(char);
            if (index === -1) {
                throw new Error(`Invalid base32 character: ${char}`);
            }
            
            value = (value << 5) | index;
            bits += 5;
            
            if (bits >= 8) {
                output.push((value >>> (bits - 8)) & 255);
                bits -= 8;
            }
        }
        
        return new Uint8Array(output);
    }
}

// Make TOTPGenerator available globally for popup usage
window.TOTPGenerator = TOTPGenerator;