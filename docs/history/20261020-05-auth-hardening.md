---
title: "Fix: Auth Hardening — KDF Upgrade, Lockout, Change PIN, Full Lock"
scope: history
type: bug-fix
severity: "High"
topics: [auth-hardening, bug-fix, crypto, pbkdf2, lockout, migration]
status: "Completed"
ticket: "N/A"
last_updated: "2026-10-20"
---

# Fix: Auth Hardening — KDF Upgrade, Lockout, Change PIN, Full Lock

> Date: 2026-10-20
> Type: Bug Fix
> Ticket: N/A
> Branch: `fix/auth-hardening` (stacked on `fix/critical-security`)
> Author: Tareq Nassry (with Claude Code)
> Severity: High

---

## Problem

| ID | Issue | Impact |
|----|-------|--------|
| H2 | PIN min length 3, UI suggested "1234"; PBKDF2 100k iterations; salt + verifier readable on disk | Malware copying `chrome.storage` cracks a 4–6 digit PIN in seconds to minutes |
| L1 | No rate limit on PIN attempts | Unlimited guessing from the UI |
| M4 | No way to change the PIN | A weak PIN could never be replaced without losing data |
| M3 | Accounts created before encryption stayed plaintext forever | Plaintext seeds at rest |
| L2 | Auto-lock left names, emails and last codes in the DOM and kept the updater running | Data visible behind the lock screen; updater fed ciphertext to TOTP |
| L6 | `twinkey_verify_plain` stored the verifier in plaintext | Redundant — the AES-GCM tag already verifies the key |

### Root Cause

Secrets are encrypted directly with the PIN-derived key (no wrapped data key) and the KDF parameters were hardcoded, so there was no path to change the PIN or the iteration count.

---

## Proposed Fix Approaches

1. **Wrapped data key** — random vault key, PIN only wraps it.
   - Pro: PIN change = re-wrap one key.
   - Con: New storage format + migration of every vault; larger change.
2. **Re-encrypt everything on PIN/KDF change** — keep current format, add versioned iterations.
   - Pro: No format change; small diff; fits ≤ hundreds of accounts.
   - Con: PIN change cost grows with account count.

**Chosen Approach:** 2. `rekeyVault()` writes accounts, salt, verifier and `twinkey_kdf_iter` in one `chrome.storage.local.set()` so they can never diverge.

---

## Fix Applied

### Files Modified
| File | Change |
|------|--------|
| `js/crypto.js` | `CURRENT_ITERATIONS = 600000`; `twinkey_kdf_iter` read on login (missing = 100k); `buildRekey()` (no storage writes, reuses token value); verifier = "token decrypts", plaintext copy honored only while it exists; `getLockoutRemaining` / `recordFailedAttempt` (5 free, then 30 s doubling, max 15 min); storage helpers `storageGet/Set/Remove` |
| `js/storage.js` | `rekeyVault(newPassword)` — aborts with no write if any account fails to decrypt, archives old salt in `twinkey_salt_archive`; `migratePlaintextSecrets()`; `getSaltArchive()` |
| `js/popup.js` | `afterUnlock()` (migrate + KDF upgrade, never blocks login); lockout toast with remaining seconds; `MIN_PIN_LENGTH = 6` + confirmation at setup; Change PIN handler; weak-PIN banner for existing short PINs; `lockApp()` stops updater and wipes accounts, folders, forms and password fields |
| `popup.html` | `#confirmMasterPassword`; Change PIN section (`#currentPin`, `#newPin`, `#confirmNewPin`, `#changePinBtn`); `#weakPinBanner`; PIN inputs `maxlength` 20 → 64 with `autocomplete` hints |
| `tests/selftest.mjs` | Legacy setup reproduced exactly (100k + plaintext verifier); 5 new tests |

> ⚠️ Note: Existing PINs shorter than 6 characters still unlock (with a banner) — enforcing on login would lock users out.

> ⚠️ Note: First unlock after this change takes ~1 s longer once (100k verify + 600k re-encrypt).

---

## Testing & Validation

**Testing Approach:** `node tests/selftest.mjs` — 14/14 pass.

| What Was Tested | Result | Notes |
|----------------|--------|-------|
| Legacy vault: plaintext migrated, 100k → 600k, same PIN works, `verify_plain` removed, no plaintext secret in storage | Pass | — |
| v1.1 backup still imports after the vault salt was replaced (archive) | Pass | Bug reproduced with old 100k format |
| New setup: 600k, no plaintext verifier | Pass | — |
| Change PIN: old PIN rejected, new PIN decrypts | Pass | — |
| Rekey with an undecryptable account aborts with storage byte-identical | Pass | — |
| Lockout after 5 failures; correct PIN blocked while locked; success clears counter | Pass | — |
| Browser runtime (banner, Change PIN UI, lock wipe) | Not tested | Manual check pending |

---

## Prevention

- KDF params are data (`twinkey_kdf_iter`), so future upgrades reuse `rekeyVault()`.
- Salt archive keeps old backups readable across every rekey.

---

## Related

- Plan: Phase 2 of the 2026-10-20 audit plan
- Related docs: [20261020-04-critical-security-fixes.md](20261020-04-critical-security-fixes.md), [overview.md — Storage Keys](../architecture/overview.md)
