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

test("Legacy v1.1 encrypted backup (salt not stored) can be recovered", async () => {
    // Reproduce the old bug: export ran setupPasswordAuth(exportPw), overwriting the vault salt,
    // then encrypted the payload with that key and did not store the salt in the file.
    const vault = await newVault("123456");
    const exportCrypto = new vault.ctx.CryptoManager();
    await exportCrypto.setupPasswordAuth("legacy-pass");
    const payload = { accounts: [{ id: "acc1", name: "Old", service: "Other", email: "", secret: SECRET, encrypted: false }], folders: [], settings: {} };
    const legacyFile = { exportedAt: new Date().toISOString(), version: "1.1", encrypted: true, encryptedData: await exportCrypto.encrypt(JSON.stringify(payload)) };

    // After the bug only the export password unlocks the vault
    const victim = new vault.ctx.CryptoManager();
    assert.equal(await victim.authenticateWithPassword("legacy-pass"), true);
    vault.storage.cryptoManager = victim;

    const saltBefore = vault.local.dump().twinkey_salt;
    const summary = await vault.storage.importData(legacyFile, "legacy-pass", "replace");
    assert.equal(summary.accounts, 1);
    assert.equal(vault.local.dump().twinkey_salt, saltBefore);
    const [account] = await vault.storage.getAccounts();
    assert.equal(await vault.storage.getDecryptedSecret(account.id), SECRET);
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
