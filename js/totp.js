// TOTP (Time-based One-Time Password) Generator
// Implementation based on RFC 6238

class TOTPGenerator {
    constructor() {
        this.timeStep = 30; // 30 seconds
        this.digits = 6; // 6 digit codes
    }

    /**
     * Generate TOTP code from secret key
     * @param {string} secret - Base32 encoded secret key
     * @param {number} timestamp - Optional timestamp (default: current time)
     * @returns {string} 6-digit TOTP code
     */
    generate(secret, timestamp = null) {
        try {
            // Use current time if not provided
            const time = timestamp || Math.floor(Date.now() / 1000);
            
            // Calculate time counter
            const counter = Math.floor(time / this.timeStep);
            
            // Decode base32 secret
            const key = this.base32Decode(secret.replace(/\s+/g, "").toUpperCase());
            
            // Generate HMAC-SHA1
            const hmac = this.hmacSha1(key, this.intToBytes(counter));
            
            // Apply dynamic truncation
            const code = this.truncate(hmac);
            
            // Return 6-digit code with leading zeros
            return code.toString().padStart(this.digits, "0");
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
        
        // Check if it"s valid base32 (A-Z, 2-7, =)
        const base32Regex = /^[A-Z2-7=]+$/;
        
        return base32Regex.test(cleanSecret) && cleanSecret.length >= 16;
    }

    /**
     * Decode base32 string to bytes
     * @param {string} base32 - Base32 encoded string
     * @returns {Uint8Array} Decoded bytes
     */
    base32Decode(base32) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const map = {};
        
        for (let i = 0; i < alphabet.length; i++) {
            map[alphabet[i]] = i;
        }

        // Remove padding
        base32 = base32.replace(/=+$/, "");
        
        let bits = 0;
        let value = 0;
        const output = [];

        for (let i = 0; i < base32.length; i++) {
            const char = base32[i];
            if (!(char in map)) {
                throw new Error(`Invalid character in base32: ${char}`);
            }

            value = (value << 5) | map[char];
            bits += 5;

            if (bits >= 8) {
                output.push((value >>> (bits - 8)) & 255);
                bits -= 8;
            }
        }

        return new Uint8Array(output);
    }

    /**
     * Convert integer to 8-byte array (big-endian)
     * @param {number} num - Integer to convert
     * @returns {Uint8Array} 8-byte array
     */
    intToBytes(num) {
        const bytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            bytes[i] = num & 0xff;
            num = num >> 8;
        }
        return bytes;
    }

    /**
     * HMAC-SHA1 implementation
     * @param {Uint8Array} key - Secret key
     * @param {Uint8Array} message - Message to authenticate
     * @returns {Uint8Array} HMAC result
     */
    hmacSha1(key, message) {
        const blockSize = 64;
        const outputSize = 20;

        // Keys longer than block size are shortened
        if (key.length > blockSize) {
            key = this.sha1(key);
        }

        // Keys shorter than block size are zero-padded
        if (key.length < blockSize) {
            const newKey = new Uint8Array(blockSize);
            newKey.set(key);
            key = newKey;
        }

        // Compute inner and outer padded keys
        const innerKey = new Uint8Array(blockSize);
        const outerKey = new Uint8Array(blockSize);

        for (let i = 0; i < blockSize; i++) {
            innerKey[i] = key[i] ^ 0x36;
            outerKey[i] = key[i] ^ 0x5c;
        }

        // Compute inner hash
        const innerMessage = new Uint8Array(blockSize + message.length);
        innerMessage.set(innerKey);
        innerMessage.set(message, blockSize);
        const innerHash = this.sha1(innerMessage);

        // Compute outer hash
        const outerMessage = new Uint8Array(blockSize + outputSize);
        outerMessage.set(outerKey);
        outerMessage.set(innerHash, blockSize);

        return this.sha1(outerMessage);
    }

    /**
     * SHA-1 implementation
     * @param {Uint8Array} message - Message to hash
     * @returns {Uint8Array} SHA-1 hash
     */
    sha1(message) {
        // Initial hash values
        let h0 = 0x67452301;
        let h1 = 0xEFCDAB89;
        let h2 = 0x98BADCFE;
        let h3 = 0x10325476;
        let h4 = 0xC3D2E1F0;

        // Pre-processing: adding padding bits
        const ml = message.length * 8;
        const paddedMessage = new Uint8Array(message.length + 1 + 8 + (64 - ((message.length + 1 + 8) % 64)) % 64);
        paddedMessage.set(message);
        paddedMessage[message.length] = 0x80;

        // Append original length as 64-bit big-endian integer
        for (let i = 0; i < 8; i++) {
            paddedMessage[paddedMessage.length - 8 + i] = (ml >>> (8 * (7 - i))) & 0xff;
        }

        // Process message in 512-bit chunks
        for (let chunk = 0; chunk < paddedMessage.length; chunk += 64) {
            const w = new Array(80);

            // Break chunk into sixteen 32-bit words
            for (let i = 0; i < 16; i++) {
                w[i] = (paddedMessage[chunk + i * 4] << 24) |
                       (paddedMessage[chunk + i * 4 + 1] << 16) |
                       (paddedMessage[chunk + i * 4 + 2] << 8) |
                       paddedMessage[chunk + i * 4 + 3];
            }

            // Extend the sixteen 32-bit words into eighty 32-bit words
            for (let i = 16; i < 80; i++) {
                w[i] = this.rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
            }

            // Initialize hash value for this chunk
            let a = h0, b = h1, c = h2, d = h3, e = h4;

            // Main loop
            for (let i = 0; i < 80; i++) {
                let f, k;
                if (i < 20) {
                    f = (b & c) | (~b & d);
                    k = 0x5A827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ED9EBA1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8F1BBCDC;
                } else {
                    f = b ^ c ^ d;
                    k = 0xCA62C1D6;
                }

                const temp = (this.rotateLeft(a, 5) + f + e + k + w[i]) & 0xffffffff;
                e = d;
                d = c;
                c = this.rotateLeft(b, 30);
                b = a;
                a = temp;
            }

            // Add this chunk"s hash to result so far
            h0 = (h0 + a) & 0xffffffff;
            h1 = (h1 + b) & 0xffffffff;
            h2 = (h2 + c) & 0xffffffff;
            h3 = (h3 + d) & 0xffffffff;
            h4 = (h4 + e) & 0xffffffff;
        }

        // Convert to byte array
        const result = new Uint8Array(20);
        [h0, h1, h2, h3, h4].forEach((h, i) => {
            result[i * 4] = (h >>> 24) & 0xff;
            result[i * 4 + 1] = (h >>> 16) & 0xff;
            result[i * 4 + 2] = (h >>> 8) & 0xff;
            result[i * 4 + 3] = h & 0xff;
        });

        return result;
    }

    /**
     * Left rotate function
     * @param {number} value - Value to rotate
     * @param {number} amount - Amount to rotate
     * @returns {number} Rotated value
     */
    rotateLeft(value, amount) {
        return ((value << amount) | (value >>> (32 - amount))) & 0xffffffff;
    }

    /**
     * Dynamic truncation as per RFC
     * @param {Uint8Array} hmac - HMAC result
     * @returns {number} Truncated value
     */
    truncate(hmac) {
        const offset = hmac[hmac.length - 1] & 0xf;
        
        const code = ((hmac[offset] & 0x7f) << 24) |
                     ((hmac[offset + 1] & 0xff) << 16) |
                     ((hmac[offset + 2] & 0xff) << 8) |
                     (hmac[offset + 3] & 0xff);

        return code % Math.pow(10, this.digits);
    }
}