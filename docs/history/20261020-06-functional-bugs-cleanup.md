---
title: "Fix: Functional Bugs + Dead Code Cleanup"
scope: history
type: bug-fix
severity: "Medium"
topics: [functional-bugs-cleanup, bug-fix, totp, performance, cleanup, manifest]
status: "Completed"
ticket: "N/A"
last_updated: "2026-10-20"
---

# Fix: Functional Bugs + Dead Code Cleanup

> Date: 2026-10-20
> Type: Bug Fix
> Ticket: N/A
> Branch: `fix/functional-bugs` (stacked on `fix/auth-hardening`)
> Author: Tareq Nassry (with Claude Code)
> Severity: Medium

---

## Problem

| Area | Issue |
|------|-------|
| TOTP | Any error returned `"000000"` — a plausible fake code. Refresh only fired when `timeLeft === 30`, so a late tick or sleep left expired codes on screen for a full period |
| Performance | Each card re-read the whole accounts array from storage and re-decrypted its secret on every render and every period (O(N²)); reorder and sortOrder init wrote once per account |
| Search | Ignored the selected folder and sort; changing sort dropped the search; crashed on accounts missing `name` / `email` |
| Folders | "Uncategorized" rendered twice (stored + hardcoded); folder icon never persisted; accounts without `folderId` hidden from the Uncategorized filter; folder drop listeners re-added on every render |
| UI bugs | Copy toast showed literal `{{name}}`; an older toast timer hid a newer toast; storage stat always "0 KB"; email field rejected usernames |
| i18n | `init()` ran twice (translations fetched twice); `ensureBootstrapLTR()` re-injected the CDN stylesheet |
| Dead code | WebAuthn / "system auth" (`prompt()` + fingerprint) in `crypto.js`; `showAccountDetails`, language stubs, `pendingAccount`, `getDragAfterElement`, debug logs in `popup.js`; legacy `app.js`, `ui.js`, `styles.css`; unused `onMessage` handlers in `background.js` (async listener also broke `sendResponse`) |
| Manifest | `activeTab`, `scripting`, `notifications` and `web_accessible_resources` unused (fingerprinting surface) |

---

## Fix Applied

### Files Modified
| File | Change |
|------|--------|
| `js/totp.js` | `generate()` returns `null` on error; error message no longer echoes the bad character |
| `js/storage.js` | `decryptAccountSecret(account)` with per-session cache keyed by ciphertext, cleared on lock; `getStorageBytes()` via `getBytesInUse`; `addFolder` persists allowlisted `icon`; unused methods removed |
| `js/popup.js` | `generateOTP(account)` → code or `LOCKED` / `INVALID` marker; period-based refresh (`floor(now / 30s)`); search combined with folder + sort; one-write reorder and sortOrder init; deduplicated Uncategorized; dropdowns scoped to new DOM; toast timer reset; copy blocked for markers; dead code removed; `window.popupManager` exposed for debugging |
| `js/crypto.js` | 527 → 309 lines: WebAuthn / system-auth / biometric code removed; storage access through `storageGet` |
| `js/i18n.js` | `ready` promise (single init), `{{placeholder}}` interpolation, CDN re-injection and RTL code removed |
| `js/background.js` | 197 → 21 lines: context menu + open popup on install |
| `manifest.json` | Permissions → `storage`, `contextMenus`; `web_accessible_resources` removed; `minimum_chrome_version` 88 → 116 |
| `popup.html` / `locales/en.json` | Dead details modal removed; email field optional ("Email / Username"); secret help text matches validation |
| Deleted | `js/app.js`, `js/ui.js`, `css/styles.css` |

> ⚠️ Note: Clipboard auto-clear was skipped — reading the clipboard needs the `clipboardRead` permission, and blindly clearing would wipe unrelated content. The popup closing already ends the session.

---

## Testing & Validation

**Testing Approach:** `node tests/selftest.mjs` (18/18 pass) + headless Chrome for Testing 148 driven over CDP (scratch script, not committed): extension loaded unpacked, real `popup.html`.

| What Was Tested | Result | Notes |
|----------------|--------|-------|
| TOTP null for invalid secret; cache cleared on lock; folder icon allowlist; i18n placeholders | Pass | Node |
| Setup rejects 3-char PIN; 6-char PIN accepted | Pass | Browser |
| Account named `<img src=x id=pwn>` renders as text, no element injected | Pass | Browser |
| Invalid secret rejected with toast | Pass | Browser |
| Lock wipes cards and folders; wrong PIN rejected; unlock restores 2 cards | Pass | Browser |
| Add after unlock adds exactly one account (no duplicate listeners) | Pass | Browser |
| Single "Uncategorized" in sidebar; folder with icon created | Pass | Browser |
| Search + export v1.2 (600k) + storage stat "1.5 KB" + Change PIN | Pass | Browser |
| Console errors during the run | Pass | None |
| 780×560 toolbar popup layout | Fail | Header buttons clipped — fixed in UI redesign |

---

## Related

- Plan: Phase 3 of the 2026-10-20 audit plan
- Related docs: [20261020-05-auth-hardening.md](20261020-05-auth-hardening.md), [infrastructure.md](../architecture/infrastructure.md)
