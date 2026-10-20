---
title: "Remove QR Code Scanning — Retroactive Documentation"
scope: history
type: retroactive
status: Completed
topics: [remove-qr-scanning, retroactive, feature, content-script, manifest]
load_when: re-adding QR import, cleaning manifest permissions, onboarding
skip_when: unrelated features or fixes
last_updated: 2026-10-20
---

# Remove QR Code Scanning

> File: `20261020-03-remove-qr-scanning.md`
> Type: Refactor (feature removal)
> Ticket: N/A
> Branch: Unknown — committed directly to `main`
> Documented: Retroactive — git-based reconstruction
> Documentation Date: 2026-10-20
> Original Implementation Date: 2025-12-15
> Status: Completed (Retroactive)

---

## Overview

Removes the content script that ran on every page to detect `otpauth://` QR codes and the "Scan QR Code" image context menu. Reason not recorded — code comment says "disabled as requested".

---

## What Was Built

### Files Added
| File | Purpose |
|------|---------|
| — | No new files |

### Files Modified
| File | Change |
|------|--------|
| `js/content-script.js` | Deleted (259 lines, `SimpleQRParser` relying on an unbundled `jsQR`) |
| `manifest.json` | `content_scripts` block removed |
| `js/background.js` | `scanQRCode` context menu and `scanImageForQR()` commented out; `openTwinKey` page menu kept |

### Database Changes
- None.

---

## Implementation Notes

- Decision recorded as ADR-004 in `docs/architecture/decisions.md`.

> ⚠️ Note: `activeTab`, `scripting` permissions and `web_accessible_resources` (`js/*` to `<all_urls>`) are leftovers from the content script — no remaining callers.

---

## API / Endpoints (if applicable)

N/A — no API.

---

## Testing

> ⚠️ Test results not available — retroactive documentation.

| What Was Checked | Result |
|----------------|--------|
| No `chrome.scripting` / content-script callers remain | Working (grep, 2026-10-20) |
| Extension loads without the content script | Unknown |

---

## Related

- Ticket: N/A
- Commit(s): `613b8ff`
- Related docs: [decisions.md — ADR-004](../architecture/decisions.md), [infrastructure.md — Manifest Summary](../architecture/infrastructure.md)
