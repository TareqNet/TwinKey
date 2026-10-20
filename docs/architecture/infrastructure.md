---
title: Infrastructure & Deployment
scope: architecture
type: infrastructure
topics: [distribution, environments, manifest, permissions]
load_when: packaging or publishing the extension, manifest/permission changes, environment setup, new developer onboarding
skip_when: UI or logic changes with no manifest impact
last_updated: 2026-10-20
---

# Infrastructure — Twin Key

## Servers

| Server | Role | OS | IP / Hostname |
|--------|------|----|---------------|
| N/A | No servers — client-side extension only | N/A | N/A |

---

## CI/CD Pipeline

**Source**: GitHub — https://github.com/TareqNet/TwinKey
**Trigger**: None — no pipeline configured.

| Stage | Tool | Notes |
|-------|------|-------|
| Source | GitHub | `main` is the release branch |
| Secrets | N/A | No secrets required |
| Automation | N/A | No build, lint or test tooling |
| Infrastructure | N/A | — |
| Containers | N/A | — |

---

## Deployment Flow

```
feature/{slug}
    ↓ load unpacked in Chrome, manual test
    ↓ merge → main
    ↓ users pull main and reload the extension
```

**Rollback**: `git checkout <previous-commit>` and click "Reload" on `chrome://extensions`.

---

## Environment Details

| Field | Production | Staging | Development |
|-------|-----------|---------|-------------|
| URL | Not on Chrome Web Store | N/A | `chrome-extension://<id>/popup.html` (`?window=1` = detached) |
| Storage | `chrome.storage.local` | N/A | `chrome.storage.local`, or `localStorage` when opened outside the extension |
| Deploy method | Load unpacked (repo root) | N/A | Load unpacked + "Reload" |

Local static preview (no `chrome.*` APIs, uses `localStorage` fallback):

```bash
python3 -m http.server 8000
```

---

## Manifest Summary

| Field | Value |
|-------|-------|
| `manifest_version` | 3 |
| `version` | 1.0.0 |
| `minimum_chrome_version` | 116 |
| Permissions | `storage`, `contextMenus` |
| `host_permissions` | none |
| Service worker | `js/background.js` |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'` |
| `web_accessible_resources` | none (removed 2026-10-20) |

> 💡 Tip: Run `node tests/selftest.mjs` before every merge — it covers TOTP vectors, crypto, export/import and storage contracts.

---

## Key Services

None — no CDN or external service. CSS, icons (inline SVG sprite) and scripts all ship in the extension.

---

## Backup & Recovery

- **User data**: manual JSON export from Settings → Backup (v1.2: password-protected with 600k PBKDF2, or plain).
- **Restore test**: encrypted export → import round-trip covered by `tests/selftest.mjs` and the 2026-10-20 headless browser run.
