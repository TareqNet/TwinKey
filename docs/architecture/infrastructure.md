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
| URL | Not on Chrome Web Store | N/A | `chrome-extension://<id>/popup.html` |
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
| `minimum_chrome_version` | 88 |
| Permissions | `storage`, `activeTab`, `contextMenus`, `notifications`, `scripting` |
| `host_permissions` | none |
| Service worker | `js/background.js` |
| CSP `style-src` | `'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com` |
| `web_accessible_resources` | `css/*`, `js/*`, `locales/*` to `<all_urls>` |

> ⚠️ Note: `activeTab` and `scripting` have no callers since the content script was removed (2025-12-15). `web_accessible_resources` was needed only by the content script. Both are candidates for removal.

---

## Key Services

| Service | Version | Host | Purpose |
|---------|---------|------|---------|
| Bootstrap CSS | 5.3.0 | cdn.jsdelivr.net | Layout and components styling |
| Bootstrap Icons | 1.11.0 | cdn.jsdelivr.net | Icon font |

---

## Backup & Recovery

- **User data**: manual JSON export from Settings. Use the unencrypted option only (encrypted export is broken — see `PROJECT_MEMORY.md` Known Issues).
- **Restore test**: never tested with encrypted files; unencrypted import path not runtime-tested on 2026-10-20.
