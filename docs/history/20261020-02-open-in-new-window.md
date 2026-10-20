---
title: "Open in New Window — Retroactive Documentation"
scope: history
type: retroactive
status: Completed
topics: [open-in-new-window, retroactive, feature, session-storage, auth]
load_when: changing window/launch behavior, touching login flow or chrome.storage.session, onboarding
skip_when: unrelated features or fixes
last_updated: 2026-10-20
---

# Open in New Window

> File: `20261020-02-open-in-new-window.md`
> Type: Feature
> Ticket: N/A
> Branch: Unknown — committed directly to `main`
> Documented: Retroactive — git-based reconstruction + code inspection
> Documentation Date: 2026-10-20
> Original Implementation Date: 2025-09-11 (header button) · 2025-12-15 (login-screen button + auto-login)
> Status: Completed (Retroactive)

---

## Overview

Opens Twin Key in a detached, centered 1100×850 Chrome popup window instead of the toolbar popup, and carries the login over so the user does not type the PIN twice.

---

## What Was Built

### Files Added
| File | Purpose |
|------|---------|
| — | No new files |

### Files Modified
| File | Change |
|------|--------|
| `popup.html` | `#openInTabBtn` in header (2025-09-11); `#openInNewWindowAuthBtn` on login screen (2025-12-15) |
| `js/popup.js` | `openInNewTab()` → `chrome.windows.create({type: "popup", width: 1100, height: 850, centered})`; `window.open` fallback outside the extension; session auto-login on init |

### Database Changes
- `chrome.storage.session.temp_auth_password` — written before opening the window, read once by the new window, then removed.

---

## Implementation Notes

- Header button: uses `this.currentPassword` (kept in memory after login) for the hand-off.
- Login-screen button: authenticates the typed password first; only on success writes it to session storage and opens the window.
- New window init: reads `temp_auth_password`, calls `authenticateWithPassword()`, removes the key.

> ⚠️ Note: The master password sits in `chrome.storage.session` (memory-only, cleared on browser exit) for the moment between open and read. Removed after use — acceptable, but keep the window short.

> ⚠️ Note: Method is named `openInNewTab()` but opens a window; button id is `openInTabBtn`.

---

## API / Endpoints (if applicable)

N/A — no API.

---

## Testing

> ⚠️ Test results not available — retroactive documentation.

| What Was Checked | Result |
|----------------|--------|
| Header button opens centered 1100×850 window | Unknown |
| Login-screen button with wrong PIN does not open window | Unknown (code checks auth first) |
| `temp_auth_password` removed after auto-login | Working by code inspection |

---

## Related

- Ticket: N/A
- Commit(s): `51299a4`, `613b8ff`
- Related docs: [overview.md — Data Flow](../architecture/overview.md)
