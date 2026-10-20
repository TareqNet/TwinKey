---
title: "Encrypted Export/Import + Extension Icons — Retroactive Documentation"
scope: history
type: retroactive
status: Completed
topics: [encrypted-export-import, retroactive, feature, crypto, storage, known-bug]
load_when: fixing export/import, touching CryptoManager key derivation, debugging lost master PIN, onboarding
skip_when: unrelated UI work
last_updated: 2026-10-20
---

# Encrypted Export/Import + Extension Icons

> File: `20261020-01-encrypted-export-import.md`
> Type: Feature
> Ticket: N/A
> Branch: Unknown — committed directly as `51299a4 Updates`
> Documented: Retroactive — git-based reconstruction + code inspection
> Documentation Date: 2026-10-20
> Original Implementation Date: 2025-09-11
> Status: Completed (Retroactive) — encrypted path **Broken** (see below)

---

## Overview

Adds an export options modal (unencrypted vs. password-protected) and password prompt on import. Same commit added PNG extension icons, the header "Open in New Window" button (see `20261020-02-open-in-new-window.md`) and `.gitignore`.

---

## What Was Built

### Files Added
| File | Purpose |
|------|---------|
| `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` | Extension icons |
| `.gitignore` | Ignores `.DS_Store` |

### Files Modified
| File | Change |
|------|--------|
| `js/storage.js` | `exportData(exportPassword)`, `getRawDataForExport()`, `encryptExportData()`, `importData(data, importPassword)`, `decryptImportData()`; export format `version` 1.0 → 1.1 with `encrypted` flag |
| `js/popup.js` | Export options modal flow, min 4-char export password, import password section |
| `popup.html` | `#exportOptionsModal`, `#exportUnencrypted` / `#exportEncrypted`, `#exportPassword`, `#importPasswordSection`, `#openInTabBtn` |
| `css/popup.css` | Modal and option styling |
| `manifest.json` | `icons` block |

### Database Changes
- Export file v1.1: `{version, encrypted, exportedAt, ...}` plus either plaintext `accounts/folders/settings` or a single `encryptedData` string.

---

## Implementation Notes

- Export decrypts every account secret with the session key, then (if a password is given) re-encrypts the whole payload with a key derived from the export password.
- Import re-encrypts each secret with the current user's key.

> ⚠️ Note — Bug 1 (Critical, data loss): `encryptExportData()` and `decryptImportData()` create a `new CryptoManager()` and call `generateEncryptionKey(password)`. That calls `setupPasswordAuth()`, which **overwrites** `twinkey_salt`, `twinkey_verify_token` and `twinkey_verify_plain` in `chrome.storage.local`. After one encrypted export: the original PIN no longer logs in; the export password logs in but derives a key from the new salt, so existing account secrets cannot be decrypted.

> ⚠️ Note — Bug 2 (Critical): the export password's random PBKDF2 salt is never written into the export file, and `encrypt()` stores only IV + ciphertext. `decryptImportData()` generates a fresh random salt, so decryption of an encrypted export always fails ("Invalid password or corrupted data") — and Bug 1 fires again.

> 💡 Tip — Fix direction: add a pure helper (e.g., `deriveKey(password, salt)`) that returns a key without touching storage; write `salt` into the export JSON; read it back on import.

---

## API / Endpoints (if applicable)

N/A — no API.

---

## Testing

> ⚠️ Test results not available — retroactive documentation.
> Verification by code inspection on 2026-10-20 (no runtime test):

| What Was Checked | Result |
|----------------|--------|
| Unencrypted export → JSON download | Unknown (code path looks correct) |
| Encrypted export leaves master auth intact | Broken — overwrites auth keys |
| Encrypted export → encrypted import round-trip | Broken — salt not persisted |
| Icons shown in toolbar / extensions page | Unknown |

---

## Related

- Ticket: N/A
- Commit(s): `51299a4`
- Related docs: [decisions.md — ADR-001](../architecture/decisions.md), [PROJECT_MEMORY.md — Known Issues](../../PROJECT_MEMORY.md)
