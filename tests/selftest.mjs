// Self-test for crypto, storage and TOTP logic. No dependencies.
// Run: node tests/selftest.mjs
// Loads the real extension scripts into a VM context with an in-memory chrome.storage shim.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function createStorageArea() {
    let data = {};
    const pick = keys => {
        if (keys == null) return structuredClone(data);
        const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        const out = {};
        list.forEach(key => { if (key in data) out[key] = structuredClone(data[key]); });
        return out;
    };
    return {
        async get(keys) { return pick(keys); },
        async set(items) { data = { ...data, ...structuredClone(items) }; },
        async remove(keys) { (Array.isArray(keys) ? keys : [keys]).forEach(key => delete data[key]); },
        async clear() { data = {}; },
        async getBytesInUse() { return JSON.stringify(data).length; },
        dump() { return structuredClone(data); }
    };
}

function loadExtension() {
    const local = createStorageArea();
    const session = createStorageArea();
    const context = {
        console, TextEncoder, TextDecoder, atob, btoa, structuredClone, crypto: globalThis.crypto,
        chrome: { storage: { local, session } },
        setTimeout, clearTimeout
    };
    context.window = context;
    vm.createContext(context);
    for (const file of ["js/totp.js", "js/crypto.js", "js/storage.js"]) {
        vm.runInContext(readFileSync(join(root, file), "utf8"), context, { filename: file });
    }
    vm.runInContext("this.CryptoManager = CryptoManager; this.StorageManager = StorageManager; this.TOTPGenerator = TOTPGenerator;", context);
    return { ctx: context, local, session };
}

async function newVault(pin) {
    const env = loadExtension();
    const crypto = new env.ctx.CryptoManager();
    const storage = new env.ctx.StorageManager();
    await storage.initializeCrypto(crypto);
    assert.equal(await crypto.setupPasswordAuth(pin), true);
    return { ...env, crypto, storage };
}

// Reproduce the pre-2026-10-20 setupPasswordAuth(): 100k iterations, plaintext verifier, no kdf_iter.
// The old export code called this with the export password, which overwrote the vault salt.
async function legacySetup(env, crypto, password) {
    const salt = crypto.generateSalt();
    const key = await crypto.deriveKey(password, salt, 100000);
    const token = globalThis.crypto.randomUUID();
    await env.local.set({
        twinkey_salt: Array.from(salt).join(","),
        twinkey_verify_token: await crypto.encryptWithKey(key, token),
        twinkey_verify_plain: token
    });
    return key;
}

const SECRET = "JBSWY3DPEHPK3PXP";
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("TOTP matches RFC 6238 SHA-1 vectors", async () => {
    const { ctx } = loadExtension();
    const totp = new ctx.TOTPGenerator();
    // Base32 of ASCII "12345678901234567890"
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const vectors = { 59: "287082", 1111111109: "081804", 1111111111: "050471", 1234567890: "005924", 2000000000: "279037", 20000000000: "353130" };
    for (const [time, code] of Object.entries(vectors)) {
        assert.equal(await totp.generate(secret, Number(time)), code, `time ${time}`);
    }
});

test("TOTP returns null (not a fake code) for an invalid secret", async () => {
    const { ctx } = loadExtension();
    assert.equal(await new ctx.TOTPGenerator().generate("not base32!"), null);
});

test("Secret cache is bypassed and cleared once the vault locks", async () => {
    const vault = await newVault("123456");
    const id = await vault.storage.addAccount({ name: "A", service: "Other", email: "", secret: SECRET });
    const account = await vault.storage.getAccount(id);
    assert.equal(await vault.storage.decryptAccountSecret(account), SECRET);
    assert.equal(vault.storage.secretCache.size, 1);

    vault.crypto.logout();
    assert.equal(await vault.storage.decryptAccountSecret(account), null);
    assert.equal(vault.storage.secretCache.size, 0);
});

test("Folder icon is persisted and restricted to the allowlist", async () => {
    const vault = await newVault("123456");
    await vault.storage.addFolder({ id: "work", name: "Work", icon: "bi-briefcase" });
    await vault.storage.addFolder({ id: "bad", name: "Bad", icon: "bi-x\" onload=\"" });
    const byId = Object.fromEntries((await vault.storage.getFolders()).map(f => [f.id, f]));
    assert.equal(byId.work.icon, "bi-briefcase");
    assert.equal(byId.bad.icon, "bi-folder");
});

test("i18n fills {{placeholders}} and keeps string fallbacks", async () => {
    const context = {
        document: { querySelectorAll: () => [] },
        fetch: async () => ({ json: async () => ({ copied: "OTP code copied for {{name}}" }) }),
        console
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(readFileSync(join(root, "js/i18n.js"), "utf8"), context);
    await context.window.i18n.ready;
    assert.equal(context.window.i18n.t("copied", { name: "GitHub" }), "OTP code copied for GitHub");
    assert.equal(context.window.i18n.t("missing", "Fallback"), "Fallback");
    assert.equal(context.window.i18n.t("missing"), "missing");
});

test("Encrypted export does not touch the vault auth keys", async () => {
    const vault = await newVault("123456");
    await vault.storage.addAccount({ name: "Google", service: "Google", email: "a@b.c", secret: SECRET });
    const before = vault.local.dump();

    const result = await vault.storage.exportData("export-pass-1");
    const after = vault.local.dump();

    assert.equal(result.skipped, 0);
    assert.equal(result.file.encrypted, true);
    assert.equal(result.file.version, "1.2");
    assert.equal(typeof result.file.kdf.salt, "string");
    assert.equal(result.file.accounts, undefined, "plaintext must not leak into encrypted file");
    for (const key of ["twinkey_salt", "twinkey_verify_token", "twinkey_verify_plain"]) {
        assert.deepEqual(after[key], before[key], `${key} changed`);
    }

    // Original PIN still works and secrets still decrypt
    const fresh = new vault.ctx.CryptoManager();
    assert.equal(await fresh.authenticateWithPassword("123456"), true);
});

test("Encrypted export round-trips into another vault with a different PIN", async () => {
    const source = await newVault("111111");
    await source.storage.addAccount({ name: "GitHub", service: "GitHub", email: "dev", secret: SECRET, folderId: "uncategorized" });
    const { file } = await source.storage.exportData("export-pass-1");

    const target = await newVault("222222");
    const targetSaltBefore = target.local.dump().twinkey_salt;
    const summary = await target.storage.importData(JSON.parse(JSON.stringify(file)), "export-pass-1", "replace");

    assert.equal(summary.accounts, 1);
    assert.equal(target.local.dump().twinkey_salt, targetSaltBefore, "import must not rewrite vault salt");
    const [account] = await target.storage.getAccounts();
    assert.equal(account.encrypted, true);
    assert.notEqual(account.secret, SECRET, "secret must be stored encrypted");
    assert.equal(await target.storage.getDecryptedSecret(account.id), SECRET);
});

test("Wrong import password fails and leaves vault untouched", async () => {
    const source = await newVault("111111");
    await source.storage.addAccount({ name: "A", service: "Other", email: "", secret: SECRET });
    const { file } = await source.storage.exportData("right-password");

    const target = await newVault("222222");
    const before = target.local.dump();
    await assert.rejects(() => target.storage.importData(file, "wrong-password"), /Invalid password/);
    assert.deepEqual(target.local.dump(), before);
});

test("Legacy v1.1 backup is recovered, even after the vault was upgraded", async () => {
    const env = loadExtension();
    const crypto = new env.ctx.CryptoManager();
    const storage = new env.ctx.StorageManager();
    await storage.initializeCrypto(crypto);

    // Old vault with PIN 1234, then the buggy v1.1 export with "legacy-pass"
    await legacySetup(env, crypto, "1234");
    const exportKey = await legacySetup(env, crypto, "legacy-pass");
    const payload = { accounts: [{ id: "acc1", name: "Old", service: "Other", email: "", secret: SECRET, encrypted: false }], folders: [], settings: {} };
    const legacyFile = { exportedAt: new Date().toISOString(), version: "1.1", encrypted: true, encryptedData: await crypto.encryptWithKey(exportKey, JSON.stringify(payload)) };

    // After the bug only the export password unlocks; unlocking upgrades the KDF (salt replaced)
    assert.equal(await crypto.authenticateWithPassword("1234"), false);
    assert.equal(await crypto.authenticateWithPassword("legacy-pass"), true);
    assert.equal(crypto.needsKdfUpgrade(), true);
    await storage.rekeyVault("legacy-pass");
    assert.equal(env.local.dump().twinkey_salt_archive.length, 1, "old salt archived");

    const summary = await storage.importData(legacyFile, "legacy-pass", "replace");
    assert.equal(summary.accounts, 1);
    const [account] = await storage.getAccounts();
    assert.equal(await storage.getDecryptedSecret(account.id), SECRET);
});

test("Legacy vault: plaintext secrets migrated, KDF upgraded to 600k, PIN unchanged", async () => {
    const env = loadExtension();
    const crypto = new env.ctx.CryptoManager();
    const storage = new env.ctx.StorageManager();
    await storage.initializeCrypto(crypto);
    const oldKey = await legacySetup(env, crypto, "1234");
    await env.local.set({ otp_accounts: [
        { id: "enc", name: "Enc", service: "Other", email: "", secret: await crypto.encryptWithKey(oldKey, SECRET), encrypted: true },
        { id: "plain", name: "Plain", service: "Other", email: "", secret: SECRET, encrypted: false }
    ] });

    assert.equal(await crypto.authenticateWithPassword("1234"), true);
    assert.equal(await storage.migratePlaintextSecrets(), 1);
    await storage.rekeyVault("1234");

    const stored = env.local.dump();
    assert.equal(stored.twinkey_kdf_iter, 600000);
    assert.equal("twinkey_verify_plain" in stored, false, "plaintext verifier removed");
    assert.equal(JSON.stringify(stored).includes(SECRET), false, "no plaintext secret left");
    assert.equal(crypto.needsKdfUpgrade(), false);

    const fresh = new env.ctx.CryptoManager();
    assert.equal(await fresh.authenticateWithPassword("1234"), true);
    storage.cryptoManager = fresh;
    assert.equal(await storage.getDecryptedSecret("enc"), SECRET);
    assert.equal(await storage.getDecryptedSecret("plain"), SECRET);
});

test("New setup uses 600k iterations and stores no plaintext verifier", async () => {
    const vault = await newVault("123456");
    const stored = vault.local.dump();
    assert.equal(stored.twinkey_kdf_iter, 600000);
    assert.equal("twinkey_verify_plain" in stored, false);
    assert.equal(await new vault.ctx.CryptoManager().authenticateWithPassword("123456"), true);
});

test("Change PIN re-encrypts the vault", async () => {
    const vault = await newVault("111111");
    const id = await vault.storage.addAccount({ name: "A", service: "Other", email: "", secret: SECRET });
    await vault.storage.rekeyVault("222222");

    assert.equal(await new vault.ctx.CryptoManager().authenticateWithPassword("111111"), false);
    const fresh = new vault.ctx.CryptoManager();
    assert.equal(await fresh.authenticateWithPassword("222222"), true);
    vault.storage.cryptoManager = fresh;
    assert.equal(await vault.storage.getDecryptedSecret(id), SECRET);
});

test("Rekey aborts and writes nothing when an account cannot be decrypted", async () => {
    const vault = await newVault("111111");
    await vault.storage.addAccount({ name: "A", service: "Other", email: "", secret: SECRET });
    const other = await newVault("999999");
    const foreign = await other.crypto.encrypt(SECRET);
    const accounts = await vault.storage.getAccounts();
    accounts[0].secret = foreign;
    await vault.local.set({ otp_accounts: accounts });

    const before = vault.local.dump();
    await assert.rejects(() => vault.storage.rekeyVault("222222"), /cannot be decrypted/);
    assert.deepEqual(vault.local.dump(), before);
});

test("Lockout after 5 failed attempts, cleared by a later success", async () => {
    const vault = await newVault("123456");
    const crypto = new vault.ctx.CryptoManager();
    for (let i = 0; i < 5; i++) {
        assert.equal(await crypto.authenticateWithPassword("000000"), false);
    }
    await assert.rejects(() => crypto.authenticateWithPassword("123456"), error => error.retryAfterMs > 25000);

    // Simulate the lockout expiring
    const failures = vault.local.dump().twinkey_auth_failures;
    await vault.local.set({ twinkey_auth_failures: { ...failures, lockedUntil: Date.now() - 1 } });
    assert.equal(await crypto.authenticateWithPassword("123456"), true);
    assert.equal("twinkey_auth_failures" in vault.local.dump(), false);
});

test("validateImport rejects bad shapes and sanitizes fields", async () => {
    const { ctx } = loadExtension();
    const validate = ctx.StorageManager.validateImport;

    assert.throws(() => validate({ folders: {} }), /Invalid backup/);
    assert.throws(() => validate(null), /Invalid backup/);
    assert.throws(() => validate([]), /Invalid backup/);

    const result = validate({
        accounts: [
            { id: 'x"]', name: "<style>*{}</style>", service: "Google", email: "a@b.c", secret: SECRET },
            { name: "", secret: SECRET },
            { name: "No secret" },
            { name: "Foreign ciphertext", secret: SECRET, encrypted: true },
            { name: "Bad base32", secret: "not-base32!" }
        ],
        folders: [{ id: "f1", name: "Work", icon: 'bi-x" onload="' }, { id: "f1", name: "Dup" }, { name: 42 }],
        settings: { theme: "neon", showEmails: true, evil: 1 }
    });

    assert.equal(result.accounts.length, 1);
    assert.match(result.accounts[0].id, ctx.StorageManager.ID_PATTERN, "unsafe id replaced");
    assert.equal(result.accounts[0].name, "<style>*{}</style>", "text kept as text, escaping happens at render");
    assert.equal(result.folders.length, 1);
    assert.equal(result.folders[0].icon, "bi-folder", "icon outside allowlist replaced");
    assert.deepEqual({ ...result.settings }, { showEmails: true });
    assert.equal(result.skipped, 6);
});

test("Merge import keeps existing accounts and overwrites same id", async () => {
    const vault = await newVault("123456");
    await vault.storage.addAccount({ id: "keep", name: "Keep", service: "Other", email: "", secret: SECRET });
    await vault.storage.addAccount({ id: "same", name: "Old name", service: "Other", email: "", secret: SECRET });
    const file = { version: "1.2", encrypted: false, accounts: [{ id: "same", name: "New name", service: "Other", secret: SECRET }, { id: "new", name: "New", service: "Other", secret: SECRET }] };

    await vault.storage.importData(file, null, "merge");
    const byId = Object.fromEntries((await vault.storage.getAccounts()).map(a => [a.id, a]));
    assert.deepEqual(Object.keys(byId).sort(), ["keep", "new", "same"]);
    assert.equal(byId.same.name, "New name");
    assert.ok((await vault.storage.getFolders()).some(f => f.id === "uncategorized"));
});

test("Storage fails closed when not authenticated", async () => {
    const vault = await newVault("123456");
    const id = await vault.storage.addAccount({ name: "A", service: "Other", email: "", secret: SECRET });
    vault.crypto.logout();

    assert.equal(await vault.storage.addAccount({ name: "B", service: "Other", email: "", secret: SECRET }), null);
    assert.equal(JSON.stringify(vault.local.dump()).includes(SECRET), false, "no plaintext secret in storage");
    assert.equal(await vault.storage.getDecryptedSecret(id), null, "locked vault returns no secret");
    await assert.rejects(() => vault.storage.importData({ accounts: [] }), /Unlock/);
});

test("Large payload encrypts without stack overflow", async () => {
    const vault = await newVault("123456");
    const big = "x".repeat(500000);
    assert.equal(await vault.crypto.decrypt(await vault.crypto.encrypt(big)), big);
});

let failed = 0;
for (const { name, fn } of tests) {
    try {
        await fn();
        console.log(`ok   ${name}`);
    } catch (error) {
        failed++;
        console.log(`FAIL ${name}\n     ${error.stack.split("\n").slice(0, 3).join("\n     ")}`);
    }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
