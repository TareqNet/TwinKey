---
title: System Architecture Overview
scope: architecture
type: overview
topics: [components, data-flow, diagrams, storage, crypto]
load_when: planning a new feature, architecture questions, adding a new component, touching crypto or storage, onboarding
skip_when: CSS-only tweaks, copy changes, config-only changes
last_updated: 2026-10-20
---

# Architecture Overview — Twin Key

## System Diagram

```
[Chrome toolbar icon]          [Context menu "Open Twin Key"]
        │                                  │
        ▼                                  ▼
[popup.html] ◄── chrome.windows.create ── [js/background.js — service worker]
  │  (or detached 1100×850 popup window)     ├── onInstalled: default settings/folders
  │                                          ├── context menu + notifications
  │                                          └── badge reset
  ├── js/bootstrap-minimal.js  (Modal / Toast / Dropdown)
  ├── js/i18n.js               (I18nManager, locales/en.json)
  ├── js/totp.js               (TOTPGenerator, RFC 6238)
  ├── js/crypto.js             (CryptoManager, PBKDF2 + AES-256-GCM)
  ├── js/storage.js            (StorageManager)
  └── js/popup.js              (PopupManager — controller, auth flow, UI)
        │
        ▼
[chrome.storage.local]   fallback → [localStorage] (non-extension dev)
[chrome.storage.session] temp_auth_password (one-shot, new-window auto-login)
```

---

## Components

| Component | Role | Tech |
|-----------|------|------|
| `PopupManager` (`js/popup.js`) | App controller: login/setup screens, account/folder rendering, drag-and-drop, settings, export/import, new-window | Vanilla JS, DOM event delegation |
| `CryptoManager` (`js/crypto.js`) | Key derivation, verification-token auth, encrypt/decrypt secrets | Web Crypto API |
| `StorageManager` (`js/storage.js`) | CRUD for accounts/folders/settings, export/import, stats | `chrome.storage.local` / `localStorage` |
| `TOTPGenerator` (`js/totp.js`) | Base32 decode, HMAC-SHA1, 6-digit / 30s codes | Web Crypto API |
| `I18nManager` (`js/i18n.js`) | `data-i18n` attribute translation, `window.i18n.t()` | JSON locale files |
| Service worker (`js/background.js`) | Install defaults, context menu, notifications, badge | MV3 service worker |
| UI shell (`popup.html`, `css/popup.css`) | 850px popup layout, modals | Bootstrap 5.3.0 CSS + Icons from jsdelivr CDN |

> ⚠️ Note: `js/app.js`, `js/ui.js`, `css/styles.css` are leftovers from the original web-app version and are not loaded by `popup.html`.

---

## Storage Keys

| Key | Content | Encrypted |
|-----|---------|-----------|
| `otp_accounts` | Array of accounts `{id, name, service, email, secret, folderId, encrypted, lastUsed, createdAt, ...}` | `secret` only |
| `otp_folders` | Array of folders `{id, name, parentId, createdAt}`; `uncategorized` is permanent | No |
| `otp_settings` | Theme, sort, refresh options, `lastBackup` | No |
| `twinkey_salt` | PBKDF2 salt (16 bytes, comma-joined) | No |
| `twinkey_verify_token` | Verification UUID encrypted with the master key | Yes |
| `twinkey_verify_plain` | Same UUID in plaintext — compared after decryption | No |

---

## Data Flow

1. **Setup**: user sets PIN → random 16-byte salt → PBKDF2-SHA256 (100,000 iterations) → AES-256-GCM key → random UUID encrypted → salt + encrypted/plain token stored.
2. **Login**: PIN + stored salt → key → decrypt `twinkey_verify_token` → match `twinkey_verify_plain` → key kept in memory.
3. **Add account**: secret encrypted with the in-memory key (random 12-byte IV prepended, base64) → saved in `otp_accounts`.
4. **Display**: secret decrypted → `TOTPGenerator` → code + countdown refreshed every second.
5. **Logout / close**: in-memory key discarded; nothing persisted except encrypted data.
6. **New window**: password written to `chrome.storage.session.temp_auth_password` → new window reads it, logs in, removes it.

---

## Key Integrations

| Service | Direction | Protocol | Purpose |
|---------|-----------|----------|---------|
| cdn.jsdelivr.net | outbound | HTTPS (CSS/fonts) | Bootstrap 5.3.0 CSS + Bootstrap Icons 1.11.0 |
| Clipboard API | local | Browser API | Copy codes |

No backend, no telemetry, no sync.

---

## Notes

> ⚠️ `CryptoManager.generateEncryptionKey(pw)` always runs `setupPasswordAuth()`, which writes the global auth keys. Any code path that needs a throwaway key (e.g., export encryption) must not call it — see Known Issue #1 in `PROJECT_MEMORY.md`.

> ⚠️ `encrypt()` output contains IV + ciphertext only, no salt. Ciphertext is decryptable only with the key derived from the stored `twinkey_salt`.
