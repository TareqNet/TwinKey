---
title: Architecture Decision Records (ADRs)
scope: architecture
type: decisions
topics: [decisions, trade-offs, rationale, adr, auth, storage]
load_when: evaluating a new approach, revisiting a past decision, changing auth or storage, onboarding
skip_when: routine implementation, no architectural trade-offs involved
last_updated: 2026-10-20
---

# Architecture Decisions — Twin Key

> Newest first. Each entry is immutable — never edit a past decision.
> To supersede a decision, add a new entry referencing the old one.
> ADR-001 → ADR-004 were reconstructed retroactively on 2026-10-20 from code, git history and the legacy phase docs.

---

## ADR-004 — Remove QR Code Scanning

> Date: 2025-12-15
> Status: Accepted
> Ticket: N/A

**Context**

A content script ran on `<all_urls>` and a "Scan QR Code" image context menu tried to extract `otpauth://` secrets. The parser depended on `jsQR`, which was never bundled, so detection relied on URL/alt-text pattern matching only.

**Options Considered**

| Option | Pro | Con |
|--------|-----|-----|
| Keep and bundle `jsQR` | Real QR decoding | Content script on every page; larger attack surface |
| Remove the feature | No page injection, smaller code | Users enter secrets manually |

**Decision**

Removed. The code comment says "disabled as requested"; the reason was not recorded.

**Consequences**

- `js/content-script.js` deleted; context-menu entry left commented out in `js/background.js`.
- `activeTab`, `scripting` permissions and `web_accessible_resources` are now unused.

---

## ADR-003 — Container-Level Event Delegation for Drag & Drop

> Date: 2025-08-29
> Status: Accepted
> Ticket: N/A

**Context**

Per-card listeners only worked from the grip icon, cards disappeared during drag, and the last card could not move up.

**Options Considered**

| Option | Pro | Con |
|--------|-----|-----|
| Per-card listeners | Simple to start | Breaks on re-render, edge-case bugs |
| Delegation on container + index-based drop zones | One listener set, handles first/middle/last | Slightly more logic in drop calculation |

**Decision**

Container delegation with visual, index-based drop zones.

**Consequences**

- Re-rendering the list does not require re-binding listeners.
- Drop-zone cleanup on `dragend` is mandatory.

---

## ADR-002 — chrome.storage.local With localStorage Fallback

> Date: 2025-08-30
> Status: Accepted
> Ticket: N/A

**Context**

Code mixed `localStorage` and `chrome.storage.local`, causing data inconsistencies. Pages opened outside the extension have no `chrome.storage`.

**Options Considered**

| Option | Pro | Con |
|--------|-----|-----|
| `localStorage` only | Synchronous, simple | Shared with page origin in non-extension contexts |
| `chrome.storage.local` only | Extension-isolated | Breaks plain-HTTP dev preview |
| `chrome.storage.local` + fallback | Isolated in production, works in dev | Two code paths per read/write |

**Decision**

`chrome.storage.local` everywhere; `localStorage` only when `chrome.storage` is undefined.

**Consequences**

- Every storage method branches on `isExtension`.

---

## ADR-001 — PIN/Password With Verification Token (No WebAuthn)

> Date: 2025-08-29
> Status: Accepted
> Ticket: N/A

**Context**

Secrets must be encrypted at rest. WebAuthn was tried on branch `feature/add-biometric-auth` but is not usable from the extension popup; OS password verification is impossible from a browser.

**Options Considered**

| Option | Pro | Con |
|--------|-----|-----|
| WebAuthn / biometrics | No password to remember | Not available in extension context |
| "System password" + browser fingerprint | Feels native | Cannot verify the real OS password |
| PIN/password + verification token | Works everywhere, no password stored | User must remember a PIN |

**Decision**

PIN/password → PBKDF2-SHA256 (100,000 iterations, random 16-byte salt) → AES-256-GCM key. A random UUID is encrypted and stored with its plaintext; login succeeds when decryption matches.

**Consequences**

- Short PINs (e.g., 4 digits) are allowed — brute-force resistance depends on PBKDF2 cost only.
- WebAuthn and system-auth code paths remain in `js/crypto.js` as dead code.
- `setupPasswordAuth()` writes global auth state — must not be reused for throwaway keys (violated by encrypted export, see `docs/history/20261020-01-encrypted-export-import.md`).
