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
  │  (780×560 popup, or popup.html?window=1)  └── onInstalled: context menu, open popup on install
  ├── css/popup.css            (design tokens, light/dark, layout)
  ├── js/i18n.js               (I18nManager, locales/en.json)
  ├── js/totp.js               (TOTPGenerator, RFC 6238)
  ├── js/crypto.js             (CryptoManager, PBKDF2 + AES-256-GCM)
  ├── js/storage.js            (StorageManager)
  └── js/popup.js              (PopupManager — lock screen, grid, dialogs, h() DOM builder)
        │
        ▼
[chrome.storage.local]   fallback → [localStorage] (non-extension dev)
[chrome.storage.session] twinkey_handoff (one-shot, 10 s, "Unlock in a new window")
```

---

## Components

| Component | Role | Tech |
|-----------|------|------|
| `PopupManager` (`js/popup.js`) | Lock/setup screen, folder sidebar, card grid, global countdown, context menu, dialogs, drag-and-drop, settings, export/import, theme | Vanilla JS, `createElement` only |
| `CryptoManager` (`js/crypto.js`) | Key derivation, verification-token auth, encrypt/decrypt secrets | Web Crypto API |
| `StorageManager` (`js/storage.js`) | CRUD for accounts/folders/settings, export/import, stats | `chrome.storage.local` / `localStorage` |
| `TOTPGenerator` (`js/totp.js`) | Base32 decode, HMAC-SHA1, 6-digit / 30s codes | Web Crypto API |
| `I18nManager` (`js/i18n.js`) | `data-i18n` attribute translation, `window.i18n.t()` | JSON locale files |
| Service worker (`js/background.js`) | Context menu "Open Twin Key"; opens popup on install | MV3 service worker |
| UI shell (`popup.html`, `css/popup.css`) | Refined Minimal layout, `<dialog>`s, `popover` menu, SVG sprite | Native CSS custom properties |

> 💡 Tip: `window.popupManager` exposes the controller for DevTools debugging.

---

## Storage Keys

| Key | Content | Encrypted |
|-----|---------|-----------|
| `otp_accounts` | Array of accounts `{id, name, service, email, secret, folderId, encrypted, lastUsed, createdAt, ...}` | `secret` only |
| `otp_folders` | Array of folders `{id, name, parentId, createdAt}`; `uncategorized` is permanent | No |
| `otp_settings` | `appearance` (`auto` / `light` / `dark`, written only by the theme picker); legacy `theme`, display options ignored | No |
| `twinkey_salt` | PBKDF2 salt (16 bytes, comma-joined) | No |
| `twinkey_kdf_iter` | PBKDF2 iterations for the vault key (missing = legacy 100,000; current 600,000) | No |
| `twinkey_verify_token` | Verification UUID encrypted with the master key — login succeeds when it decrypts | Yes |
| `twinkey_verify_plain` | Legacy only: plaintext copy of the UUID; removed on first unlock after 2026-10-20 | No |
| `twinkey_salt_archive` | Previous vault salts; lets v1.1 encrypted backups still be imported | No |
| `twinkey_auth_failures` | `{count, lockedUntil}` — 30 s lockout after 5 failures, doubling, max 15 min | No |
| `chrome.storage.session.twinkey_handoff` | `{password, expiresAt}` for "Open in New Window" from the login screen; deleted on read, 10 s TTL | No (memory-only area) |

---

## Data Flow

1. **Setup**: user sets PIN (≥ 6 chars, confirmed) → random 16-byte salt → PBKDF2-SHA256 (600,000 iterations) → AES-256-GCM key → random UUID encrypted → salt, encrypted token and `twinkey_kdf_iter` stored.
2. **Login**: lockout check → PIN + stored salt + iterations → key → `twinkey_verify_token` must decrypt → key kept in memory. Then: plaintext accounts encrypted; legacy 100k vaults re-encrypted at 600k (`rekeyVault`, one storage write).
3. **Add account**: secret encrypted with the in-memory key (random 12-byte IV prepended, base64) → saved in `otp_accounts`.
4. **Display**: `decryptAccountSecret()` (cached by ciphertext while unlocked) → `TOTPGenerator` (null on bad secret) → codes regenerated when `floor(now / 30s)` changes; countdown every second.
5. **Lock (60 s idle) / close**: key discarded, code updater stopped, rendered accounts/folders and open forms wiped.
6. **New window**: from the login screen only — `twinkey_handoff` written with a 10 s expiry; the new window deletes it before use. From the header, the new window asks for the PIN.
7. **Change PIN**: verify current PIN → `rekeyVault(newPin)` decrypts all, re-encrypts under a new salt, archives the old salt, writes accounts + verifier in one call.

---

## Key Integrations

| Service | Direction | Protocol | Purpose |
|---------|-----------|----------|---------|
| Clipboard API | local | Browser API | Copy codes |

No backend, no telemetry, no sync, no external requests.

---

## Notes

> ⚠️ Only `setupPasswordAuth()` and `StorageManager.rekeyVault()` may write `twinkey_salt` / `twinkey_verify_token`. Throwaway keys (export/import) use the pure `CryptoManager.deriveKey()`.

> ⚠️ `encrypt()` output is base64(IV + ciphertext), no salt. Any code that replaces `twinkey_salt` must archive the old value in `twinkey_salt_archive` (ADR-005).
