---
title: "Fix: Critical Security — Export Vault Loss, Stored XSS, Fail-Open Storage"
scope: history
type: bug-fix
severity: "Critical"
topics: [critical-security-fixes, bug-fix, crypto, export-import, xss, csp]
status: "Completed"
ticket: "N/A"
last_updated: "2026-10-20"
---

# Fix: Critical Security — Export Vault Loss, Stored XSS, Fail-Open Storage

> Date: 2026-10-20
> Type: Bug Fix
> Ticket: N/A
> Branch: `fix/critical-security` (from `main`)
> Author: Tareq Nassry (with Claude Code)
> Severity: Critical

---

## Problem

| ID | Issue | User-visible impact |
|----|-------|--------------------|
| C1 | Encrypted export/import called `generateEncryptionKey(pw)` → `setupPasswordAuth()`, overwriting `twinkey_salt` / `twinkey_verify_*`. Salt never written to the file | Master PIN stops working; secrets undecryptable; encrypted import always fails. Encrypted export was the default option |
| H1 | No HTML escaping. Account/folder fields and imported `id`/`icon` went raw into `innerHTML`; `data-otp` attribute held the live code | A crafted import file can exfiltrate live OTPs via CSS selectors, show phishing forms, add tracking pixels, clobber password inputs |
| H3 | `setupEventListeners()` re-ran on every unlock | After auto-lock + unlock every action ran twice (double account add, double export) |
| M1 | Import had no schema validation and always replaced data | `folders: {}` or a malformed `id` broke the UI permanently |
| M2 | Raw PIN kept in `this.currentPassword` for the whole session and written to `chrome.storage.session` | A stale `temp_auth_password` logged the next popup in without a PIN until browser restart |
| M3 | Storage saved plaintext secrets when not authenticated; `getDecryptedSecret` returned ciphertext when locked | Silent plaintext at rest on any future code path; "000 000" codes behind the lock screen |
| L | `btoa(String.fromCharCode.apply(...))` | `RangeError` on large encrypted exports |

### Root Cause

One method (`setupPasswordAuth`) both derived a key and persisted global auth state; export/import reused it for throwaway keys. Rendering relied on template strings with no escaping layer. Storage treated "not authenticated" as "store plaintext".

---

## Fix Applied

### Files Modified
| File | Change |
|------|--------|
| `js/crypto.js` | `deriveKey(password, salt, iterations)` (pure, no storage), `encryptWithKey` / `decryptWithKey`, `getStoredSalt`, chunked `bytesToBase64` / `base64ToBytes`; `LEGACY_ITERATIONS` (100k), `EXPORT_ITERATIONS` (600k) |
| `js/storage.js` | Export v1.2 with `kdf {name, hash, iterations, salt}`; import never touches auth keys; legacy v1.1 recovery via current + archived vault salts (`twinkey_salt_archive`); `validateImport()` whitelist; `replace` / `merge` modes; single `setMany()` write; fail-closed `addAccount`, `getDecryptedSecret`, `importData` |
| `js/popup.js` | `escapeHtml()` on every template interpolation; folder icon allowlist; `CSS.escape` in selectors; `data-otp` removed; one-time listener binding; `currentPassword` removed; login-screen hand-off via `twinkey_handoff {password, expiresAt: +10s}`, always deleted on read; export password ≥ 8 + confirmation; import mode + error messages from storage |
| `popup.html` | `#exportPasswordConfirm`; import mode radios `#importModeReplace` / `#importModeMerge` |
| `manifest.json` | CSP: `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-src 'none'`, `form-action 'none'`, `img-src 'self' data:`, `connect-src 'self'`; jsdelivr kept only in `style-src` / `font-src` until Bootstrap removal |
| `tests/selftest.mjs` | New — dependency-free Node self-test loading the real scripts with a `chrome.storage` shim |

### Export file v1.2

```json
{
  "version": "1.2",
  "exportedAt": "2026-10-20T10:00:00.000Z",
  "encrypted": true,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" },
  "encryptedData": "<base64(IV + AES-GCM ciphertext)>"
}
```

> ⚠️ Note: The "Open in New Window" header button no longer carries the login; the new window asks for the PIN. The login-screen button still hands off (10 s TTL).

---

## Testing & Validation

**Testing Approach:** `node tests/selftest.mjs` (Node 24, WebCrypto). Same suite run against `main` code to confirm it detects the bugs.

| What Was Tested | Result | Notes |
|----------------|--------|-------|
| RFC 6238 SHA-1 vectors (6 timestamps) | Pass | — |
| Encrypted export leaves `twinkey_salt` / `verify_*` unchanged; original PIN still logs in | Pass | Fails on `main` |
| Export → import into another vault with a different PIN | Pass | Fails on `main` |
| Wrong import password rejected, storage byte-identical | Pass | — |
| Legacy v1.1 file (bug reproduced) recovered with current salt | Pass | — |
| `validateImport`: bad shapes rejected, unsafe id/icon replaced, settings whitelisted | Pass | — |
| Merge mode keeps existing, overwrites same id | Pass | — |
| Fail-closed: no plaintext stored when locked; locked returns no secret | Pass | Fails on `main` |
| 500 KB payload encrypt/decrypt | Pass | `RangeError` on `main` |
| Browser runtime (Load unpacked) | Not tested | Manual check pending |

---

## Prevention

- `deriveKey` is pure; persisting auth state is only done by `setupPasswordAuth`.
- All imports pass through `validateImport` and are re-encrypted with the vault key in one write.
- `tests/selftest.mjs` guards the export/import contract.

---

## Related

- Plan: Phase 1 of the 2026-10-20 audit plan
- Related docs: [20261020-01-encrypted-export-import.md](20261020-01-encrypted-export-import.md), [decisions.md — ADR-005, ADR-006](../architecture/decisions.md)
