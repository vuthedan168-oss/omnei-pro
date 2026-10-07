// OMNEI Pro - High-Grade Cryptography & Data Protection
// Uses Web Cryptography API (AES-GCM-256 + PBKDF2)

const CryptoUtils = (function () {
    const DEFAULT_TEAM_KEY = "OMNEI-Team-Shared-Secret-2026";
    const ITERATIONS = 100000;

    function bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async function deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: ITERATIONS,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    async function encryptString(plainText, password) {
        if (!plainText) return "";
        try {
            const enc = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await deriveKey(password || DEFAULT_TEAM_KEY, salt);

            const cipherBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                enc.encode(plainText)
            );

            return "ENC:v1:" + bufferToBase64(salt) + ":" + bufferToBase64(iv) + ":" + bufferToBase64(cipherBuffer);
        } catch(e) {
            console.error("encryptString error:", e);
            return plainText;
        }
    }

    async function decryptString(encryptedText, password) {
        if (!encryptedText || !encryptedText.startsWith("ENC:v1:")) {
            return encryptedText;
        }
        try {
            const parts = encryptedText.split(":");
            if (parts.length !== 5) throw new Error("Invalid payload format");
            const salt = new Uint8Array(base64ToBuffer(parts[2]));
            const iv = new Uint8Array(base64ToBuffer(parts[3]));
            const cipherBuffer = base64ToBuffer(parts[4]);

            const key = await deriveKey(password || DEFAULT_TEAM_KEY, salt);
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                cipherBuffer
            );
            return new TextDecoder().decode(decryptedBuffer);
        } catch (e) {
            console.warn("Decryption failed:", e);
            throw new Error("Mật khẩu giải mã không chính xác hoặc dữ liệu bị lỗi!");
        }
    }

    // Device Master Key for encrypting stored tokens & credentials at rest
    async function getMasterDeviceKey() {
        try {
            const stored = await chrome.storage.local.get('_master_device_key');
            if (stored && stored._master_device_key) {
                return stored._master_device_key;
            }
            const randomBytes = crypto.getRandomValues(new Uint8Array(32));
            let newKey = '';
            for (let i = 0; i < randomBytes.length; i++) {
                newKey += randomBytes[i].toString(16).padStart(2, '0');
            }
            await chrome.storage.local.set({ _master_device_key: newKey });
            return newKey;
        } catch (e) {
            return "OMNEI-Device-Fallback-Key";
        }
    }

    async function encryptAtRest(plainText) {
        if (!plainText) return "";
        try {
            const masterKey = await getMasterDeviceKey();
            return await encryptString(plainText, masterKey);
        } catch (e) {
            return plainText;
        }
    }

    async function decryptAtRest(encryptedText) {
        if (!encryptedText) return "";
        if (!encryptedText.startsWith("ENC:v1:")) return encryptedText;
        try {
            const masterKey = await getMasterDeviceKey();
            return await decryptString(encryptedText, masterKey);
        } catch (e) {
            return encryptedText;
        }
    }

    // Team 1-Click Sharing without exposing Passwords or 2FA
    async function generateTeamShareCode(account, teamPassword, expiryHours = 24) {
        const payload = {
            v: 1,
            uid: account.uid,
            name: account.name || account.uid,
            cookie: account.cookie,
            userAgent: account.userAgent || navigator.userAgent,
            proxy: account.proxy || null,
            created: Date.now(),
            expires: expiryHours > 0 ? Date.now() + (expiryHours * 3600000) : 0
        };

        const jsonStr = JSON.stringify(payload);
        const secret = teamPassword ? teamPassword : DEFAULT_TEAM_KEY;
        const encrypted = await encryptString(jsonStr, secret);
        return "OMNEISHARE:" + btoa(encrypted);
    }

    async function parseTeamShareCode(shareCode, teamPassword) {
        if (!shareCode || (!shareCode.startsWith("OMNEISHARE:") && !shareCode.startsWith("OSSHARE:"))) {
            throw new Error("Mã chia sẻ không đúng định dạng OMNEISHARE:... hoặc OSSHARE:...");
        }
        const cleanCode = shareCode.trim();
        const rawEncrypted = cleanCode.startsWith("OMNEISHARE:")
            ? atob(cleanCode.replace("OMNEISHARE:", "").trim())
            : atob(cleanCode.replace("OSSHARE:", "").trim());

        let jsonStr;
        if (teamPassword) {
            jsonStr = await decryptString(rawEncrypted, teamPassword);
        } else {
            try {
                jsonStr = await decryptString(rawEncrypted, DEFAULT_TEAM_KEY);
            } catch (e) {
                // Tương thích ngược mã OmniSession cũ
                try {
                    jsonStr = await decryptString(rawEncrypted, "OmniSession-Team-Shared-Secret-2026");
                } catch (e2) {
                    throw e;
                }
            }
        }
        const data = JSON.parse(jsonStr);

        if (data.expires && data.expires > 0 && Date.now() > data.expires) {
            throw new Error("Mã chia sẻ này đã hết hạn sử dụng!");
        }

        return {
            uid: data.uid,
            name: data.name,
            cookie: data.cookie,
            userAgent: data.userAgent,
            proxy: data.proxy,
            fromTeam: true
        };
    }

    // RFC 6238 TOTP (Time-based One-Time Password) Algorithm
    function base32ToBytes(base32) {
        if (!base32) return new Uint8Array(0);
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let clean = String(base32).replace(/[\s=-]/g, '').toUpperCase();
        let bits = '';
        for (let i = 0; i < clean.length; i++) {
            let val = alphabet.indexOf(clean[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substr(i, 8), 2));
        }
        return new Uint8Array(bytes);
    }

    async function generateTOTP(secretKey, epochSeconds = null) {
        if (!secretKey) return { otp: '', remaining: 0 };
        try {
            const keyBytes = base32ToBytes(secretKey);
            if (keyBytes.length === 0) return { otp: '', remaining: 0 };
            const epoch = (epochSeconds !== null) ? epochSeconds : Math.floor(Date.now() / 1000);
            const counter = Math.floor(epoch / 30);
            const counterBuffer = new ArrayBuffer(8);
            const view = new DataView(counterBuffer);
            view.setUint32(4, counter, false); // Big-endian 32-bit counter

            const key = await crypto.subtle.importKey(
                "raw",
                keyBytes,
                { name: "HMAC", hash: "SHA-1" },
                false,
                ["sign"]
            );
            const sig = await crypto.subtle.sign("HMAC", key, counterBuffer);
            const sigBytes = new Uint8Array(sig);
            const offset = sigBytes[sigBytes.length - 1] & 0x0f;
            const code = ((sigBytes[offset] & 0x7f) << 24) |
                         ((sigBytes[offset + 1] & 0xff) << 16) |
                         ((sigBytes[offset + 2] & 0xff) << 8) |
                         (sigBytes[offset + 3] & 0xff);
            const otp = (code % 1000000).toString().padStart(6, '0');
            const remaining = 30 - (epoch % 30);
            return { otp, remaining };
        } catch (e) {
            console.error("generateTOTP error:", e);
            return { otp: 'ERROR', remaining: 0 };
        }
    }

    // Team Bundle Sharing (Share multiple accounts with 1 code)
    async function generateTeamBundleCode(accounts, teamPassword, expiryHours = 24, staffMode = false) {
        const sanitizedList = (accounts || []).map(a => ({
            uid: a.uid,
            name: a.name || a.uid,
            cookie: a.cookie,
            platform: a.platform || 'facebook',
            userAgent: a.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
            proxy: a.proxy || null
        }));
        const payload = {
            v: 1,
            type: 'bundle',
            staffMode: Boolean(staffMode),
            count: sanitizedList.length,
            accounts: sanitizedList,
            created: Date.now(),
            expires: expiryHours > 0 ? Date.now() + (expiryHours * 3600000) : 0
        };
        const jsonStr = JSON.stringify(payload);
        const secret = teamPassword ? teamPassword : DEFAULT_TEAM_KEY;
        const encrypted = await encryptString(jsonStr, secret);
        return "OMNEISHARE:BUNDLE:" + btoa(encrypted);
    }

    async function parseTeamBundleCode(shareCode, teamPassword) {
        if (!shareCode || !shareCode.startsWith("OMNEISHARE:BUNDLE:")) {
            throw new Error("Mã không đúng định dạng OMNEISHARE:BUNDLE:...");
        }
        const rawEncrypted = atob(shareCode.replace("OMNEISHARE:BUNDLE:", "").trim());
        const secret = teamPassword ? teamPassword : DEFAULT_TEAM_KEY;
        const jsonStr = await decryptString(rawEncrypted, secret);
        const data = JSON.parse(jsonStr);
        if (data.expires && data.expires > 0 && Date.now() > data.expires) {
            throw new Error("Gói chia sẻ này đã hết hạn sử dụng!");
        }
        return data;
    }

    // Commercial License Engine
    const LICENSE_SALT = "OMNEI-COMMERCIAL-LICENSE-SALT-2026";

    async function hashString(str) {
        const enc = new TextEncoder().encode(str);
        const hashBuf = await crypto.subtle.digest("SHA-256", enc);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function getMachineId() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const stored = await chrome.storage.local.get('_omnei_machine_id');
                if (stored && stored._omnei_machine_id) {
                    return stored._omnei_machine_id;
                }
                const devKey = await getMasterDeviceKey();
                const hash = await hashString(devKey + ':OMNEI-MACHINE-ID');
                const cleanId = 'OMN-' + hash.substring(0, 4).toUpperCase() + '-' + hash.substring(4, 8).toUpperCase();
                await chrome.storage.local.set({ _omnei_machine_id: cleanId });
                return cleanId;
            } else if (typeof localStorage !== 'undefined') {
                let id = localStorage.getItem('_omnei_machine_id');
                if (!id) {
                    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
                    id = 'OMN-' + rnd.substring(0, 4) + '-' + rnd.substring(4, 8);
                    localStorage.setItem('_omnei_machine_id', id);
                }
                return id;
            }
        } catch (e) {
            console.warn("Failed to get machine id:", e);
        }
        return "OMN-DEVICE-8888";
    }

    async function generateActivationRequest(targetAccounts, machineId) {
        const m = (machineId || 'DEVICE').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const acc = parseInt(targetAccounts, 10) || 5;
        const raw = `REQ:${m}:${acc}:${LICENSE_SALT}`;
        const hash = await hashString(raw);
        const sig = hash.substring(0, 6).toUpperCase();
        return `REQ-${machineId}-${acc}ACC-${sig}`;
    }

    async function generateLicenseKey(tier = 'PRO', maxAccounts = 10, machineId = '', durationDays = 'LIFETIME') {
        const t = (tier || 'PRO').toUpperCase();
        let accPart = 'UNLIMITED';
        if (maxAccounts && maxAccounts !== 'UNLIMITED' && parseInt(maxAccounts, 10) < 999999) {
            accPart = parseInt(maxAccounts, 10) + 'ACC';
        }
        const expiry = (durationDays === 0 || durationDays === '0' || durationDays === 'LIFETIME' || durationDays === 'LIFE') 
            ? 'LIFE' 
            : String(Date.now() + (parseInt(durationDays, 10) * 86400000));

        let machClean = 'ANY';
        if (machineId && machineId !== 'ANY') {
            machClean = machineId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }

        const rawPayload = `OMNEI:${t}:${accPart}:${expiry}:${machClean}:${LICENSE_SALT}`;
        const fullHash = await hashString(rawPayload);
        const sig = fullHash.substring(0, 8).toUpperCase();
        return `OMNEI-${t}-${accPart}-${expiry.slice(0, 8)}-${machClean}-${sig}`;
    }

    async function verifyLicenseKey(key, currentMachineId = '') {
        if (!key || typeof key !== 'string') return { valid: false, reason: "Vui lòng nhập License Key!" };
        const clean = key.trim().toUpperCase();

        // 1. Master Universal Bypass Keys (Dành riêng cho Admin hoặc kiểm thử)
        if (clean === 'OMNEI-VIP-LIFETIME-2026' || clean === 'OMNEI-ENTERPRISE-UNLIMITED') {
            return {
                valid: true,
                tier: 'ENTERPRISE',
                maxAccounts: 999999,
                planName: 'OMNEI Enterprise VIP (Không giới hạn)',
                expiresText: 'Vĩnh viễn (Trọn đời)',
                key: clean
            };
        }
        if (clean === 'OMNEI-PRO-COMMERCIAL-KEY' || clean === 'OMNEI-PRO-LIFETIME') {
            return {
                valid: true,
                tier: 'PRO',
                maxAccounts: 999999,
                planName: 'OMNEI Pro Edition (Không giới hạn)',
                expiresText: 'Vĩnh viễn (Trọn đời)',
                key: clean
            };
        }

        // 2. Parse Structured Key
        const parts = clean.split('-');
        if (parts.length < 4 || parts[0] !== 'OMNEI') {
            return { valid: false, reason: "Định dạng License Key không đúng chuẩn OMNEI!" };
        }

        const tier = parts[1];
        let accPart = 'UNLIMITED';
        let expPart = 'LIFE';
        let machPart = 'ANY';
        let sig = '';

        if (parts.length >= 6) {
            // New 6-part format: OMNEI-TIER-ACC-EXP-MACH-SIG
            accPart = parts[2];
            expPart = parts[3];
            machPart = parts[4];
            sig = parts[5];
        } else if (parts.length === 5) {
            // OMNEI-TIER-ACC-EXP-SIG
            accPart = parts[2];
            expPart = parts[3];
            sig = parts[4];
        } else {
            // Old 4-part format: OMNEI-TIER-EXP-SIG
            expPart = parts[2];
            sig = parts[3];
        }

        // Check Machine Binding
        if (machPart !== 'ANY' && currentMachineId) {
            const currentClean = currentMachineId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (machPart !== currentClean) {
                return { 
                    valid: false, 
                    reason: `Mã key này được cấp riêng cho thiết bị [${machPart}], không khớp với thiết bị hiện tại [${currentClean}]!` 
                };
            }
        }

        // Check Expiry
        if (expPart !== 'LIFE') {
            const expTimestamp = parseInt(expPart, 10);
            if (!isNaN(expTimestamp) && expTimestamp > 0 && Date.now() > expTimestamp) {
                return { valid: false, reason: "Mã bản quyền này đã hết hạn sử dụng!" };
            }
        }

        // Verify Signature
        let expectedSig = '';
        if (parts.length >= 6) {
            const rawPayload = `OMNEI:${tier}:${accPart}:${expPart}:${machPart}:${LICENSE_SALT}`;
            const fullHash = await hashString(rawPayload);
            expectedSig = fullHash.substring(0, 8).toUpperCase();
        } else if (parts.length === 5) {
            const rawPayload = `OMNEI:${tier}:${accPart}:${expPart}:ANY:${LICENSE_SALT}`;
            const fullHash = await hashString(rawPayload);
            expectedSig = fullHash.substring(0, 8).toUpperCase();
        } else {
            const rawPayload = `OMNEI:${tier}:${expPart}:${LICENSE_SALT}`;
            const fullHash = await hashString(rawPayload);
            expectedSig = fullHash.substring(0, 8).toUpperCase();
        }

        if (sig !== expectedSig) {
            return { valid: false, reason: "Chữ ký bảo mật của Key không chính xác hoặc đã bị chỉnh sửa!" };
        }

        // Calculate allowed maxAccounts
        let maxAccounts = 999999;
        if (accPart.endsWith('ACC')) {
            const num = parseInt(accPart, 10);
            if (!isNaN(num) && num > 0) maxAccounts = num;
        } else if (accPart === 'UNLIMITED') {
            maxAccounts = 999999;
        }

        const tierName = tier === 'ENTERPRISE' ? 'OMNEI Enterprise VIP' : 'OMNEI Pro Edition';
        const planName = maxAccounts >= 999999 
            ? `${tierName} (Không giới hạn)` 
            : `${tierName} (${maxAccounts} Tài Khoản)`;

        return {
            valid: true,
            tier: tier === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO',
            maxAccounts: maxAccounts,
            planName: planName,
            expiresText: expPart === 'LIFE' ? 'Vĩnh viễn (Trọn đời)' : 'Theo thời hạn bản quyền',
            key: clean
        };
    }

    return {
        encryptString,
        decryptString,
        encryptAtRest,
        decryptAtRest,
        generateTeamShareCode,
        parseTeamShareCode,
        generateTeamBundleCode,
        parseTeamBundleCode,
        getMachineId,
        generateActivationRequest,
        generateLicenseKey,
        verifyLicenseKey,
        base32ToBytes,
        generateTOTP
    };
})();

// Attach globally
if (typeof window !== 'undefined') {
    window.CryptoUtils = CryptoUtils;
}
if (typeof self !== 'undefined') {
    self.CryptoUtils = CryptoUtils;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
}
