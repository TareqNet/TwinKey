---
title: "PROJECT_MEMORY — Twin Key"
scope: memory
topics: [identity, stack, architecture, ai-behavior, history, security]
note: "Hard limit: 200 content lines or 25KB. YAML is excluded from this count."
last_updated: "2026-10-20"
---

# PROJECT_MEMORY — Twin Key

> Status: Active
> Version: 1.0.0 (manifest)
> Ticket Board: N/A
> Last Updated: 2026-10-20

---

## Project Identity

| Field | Value |
|-------|-------|
| Name | Twin Key (TwinKey OTP Manager) |
| Concept | Chrome extension (Manifest V3) that stores TOTP secrets encrypted and shows live 2FA codes |
| Goal | Local-only, encrypted alternative to phone authenticator apps, inside the browser |
| Users | Individuals managing 2FA accounts on desktop Chrome |
| Developer | Tareq Nassry <tareq@tareq.website> |
| Repository | https://github.com/TareqNet/TwinKey — MIT license |

**Inputs**: Master PIN/password, account data (name, service, email, Base32 secret), JSON import files.
**Outputs**: 6-digit TOTP codes (RFC 6238, 30s), clipboard copy, JSON export files (plain or "encrypted").

---

## Interaction Layer

No API, no backend. UI is the extension popup (`popup.html`, 780×560) or a detached 1100×760 window (`popup.html?window=1`).
→ Components and data flow: `docs/architecture/overview.md`

**Data flow**: PIN → PBKDF2 (600k) key → decrypt secret from `chrome.storage.local` → `TOTPGenerator` → code in UI.

---

## Programming Approach

| Field | Value |
|-------|-------|
| Language(s) | Vanilla JavaScript (ES2020+), HTML5, CSS3 |
| Platform | Chrome Extension Manifest V3, `minimum_chrome_version` 116 |
| Pattern | Class-per-concern managers (`CryptoManager`, `StorageManager`, `PopupManager`, `TOTPGenerator`) |
| Package Manager | None — no build step, no npm dependencies. Tests: `node tests/selftest.mjs` (Node 20+) |
| UI libraries | None — native CSS tokens (light/dark), `<dialog>`, Popover API, inline SVG sprite; DOM built with `createElement` (`h()` helper) |

**Structure**: Root holds `manifest.json`, `popup.html`; `js/` managers + service worker; `css/popup.css`; `locales/en.json`; `icons/`; `tests/selftest.mjs`.
→ Full diagram: `docs/architecture/overview.md`

---

## Environment & Infrastructure

| Env | URL / Host | Notes |
|-----|-----------|-------|
| Production | Not published to Chrome Web Store | Users install via "Load unpacked" |
| Staging | N/A | No staging environment |
| Development | `chrome://extensions` → Load unpacked → repo root | `localStorage` fallback when `chrome.storage` is absent |

→ Full infra details: `docs/architecture/infrastructure.md`

### Install & First Use
1. Clone `https://github.com/TareqNet/TwinKey`.
2. Open `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the repo root.
3. Pin the extension. Set a PIN/password on first open — all secrets are encrypted with it.
4. Click "Add" to add an account; click a code to copy it; drag the grip onto a folder or between cards; `/` focuses search.

---

## Features (Current)

- **Security**: PIN/password login (≥ 6 for new PINs), AES-256-GCM secrets, PBKDF2-SHA256 600k iterations (versioned, auto-upgrade from 100k), lockout after 5 failures, Change PIN, full wipe on 60 s auto-lock.
- **Accounts**: add / edit / delete (confirm dialog), click-to-copy code, one global 30 s countdown ring, move up/down from the card menu, "last used" tracking.
- **Organization**: folders sidebar with icons (folder select under 600 px), search, sort (custom, name, service, date, last used), drag-and-drop reorder and move-to-folder.
- **Appearance**: Refined Minimal design, System / Light / Dark theme (`otp_settings.theme`), WCAG AA contrast, keyboard-accessible dialogs and menus.
- **Data**: settings modal, storage stats, JSON export/import v1.2 (plain or password-encrypted with KDF params in file; replace or merge; legacy v1.1 recovery).
- **Window**: "Open in New Window" (header + login screen); login-screen button hands off auth once (`twinkey_handoff`, 10 s TTL).
- **i18n**: English only (`locales/en.json`); `data-i18n` attributes + `window.i18n.t()`. Arabic removed 2025-08-29.
- **Removed**: QR code scanning (content script + context menu) removed 2025-12-15.

---

## Known Issues

> ⚠️ Found by code inspection on 2026-10-20 — not runtime-tested.

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | ~~Critical~~ Fixed 2026-10-20 | Encrypted export/import overwrote vault auth keys — fixed by pure `deriveKey()` + export v1.2 | `js/storage.js` |
| 2 | ~~Critical~~ Fixed 2026-10-20 | Export salt not stored — v1.2 stores `kdf`; v1.1 opened via vault salt candidates | `js/storage.js` |
| 3 | ~~Low~~ Fixed 2026-10-20 | Bootstrap CDN removed — fully offline, CSP has no external hosts | `popup.html` |
| 4 | ~~Low~~ Fixed 2026-10-20 | Unused permissions and `web_accessible_resources` removed; permissions now `storage`, `contextMenus` | `manifest.json` |
| 5 | ~~Low~~ Fixed 2026-10-20 | Dead WebAuthn/system-auth code and legacy `app.js` / `ui.js` / `styles.css` removed | `js/crypto.js` |
| 7 | ~~Medium~~ Fixed 2026-10-20 | Toolbar popup clipped at 1100×850 — now 780×560; detached window fills its window | `css/popup.css` |
| 6 | ~~Low~~ Fixed 2026-10-20 | Large-payload `btoa` overflow — chunked `bytesToBase64()` | `js/crypto.js` |

> 💡 Tip: Run `node tests/selftest.mjs` after any change to `js/crypto.js`, `js/storage.js` or `js/totp.js`.

---

## Key Decisions (summary)

- PIN/password + verification token over WebAuthn (unavailable in extension context) — ADR-001.
- `chrome.storage.local` primary, `localStorage` fallback for dev — ADR-002.
- Container-level event delegation for drag-and-drop — ADR-003.
- QR scanning removed (reason not recorded) — ADR-004.
- Export key is standalone; KDF params stored in the file; vault salts archived before replacement — ADR-005.
- Escape every template interpolation + strict CSP — ADR-006.
- Native CSS + `<dialog>` + Popover, no UI framework; DOM built without `innerHTML` — ADR-007.
→ Full ADRs: `docs/architecture/decisions.md`

---

## Future Considerations

1. Encrypted cloud backup; companion mobile app.
3. Performance for 1000+ accounts.

---

## AI Behavior

> Behavior contract for all AI assistants. CLAUDE.md, GEMINI.md, and all agent config files defer to this section.

**Session start**: Read this file completely. Do not touch code without reading PROJECT_MEMORY first.
**Load on demand**: `docs/architecture/` for structural work · `docs/history/` only when understanding a past decision. No `docs/api/` — project has no API.
**Never edit**: `docs/history/` files — append only.
**After structural changes**: update the affected section in this file + the relevant `docs/architecture/` file.
**Security**: never store plaintext secrets or the master password; test login after any `CryptoManager` change.

### Git Rules
- Branch from `main` always. No exceptions.
- Naming: `feature/{slug}` · `fix/{slug}` · `hotfix/{slug}`
- Flow: `feature/{slug}` → merge into `staging` (test) → merge `feature/{slug}` into `main` → sync `staging ← main`
- `staging` is a test environment — **never merge staging into main**.
- `hotfix`: branch from `main` → fix → merge into `main` → sync `staging ← main`.

### Documentation Rules
- Run `/zdoc` at end of any session with code changes.
- Filename: `yyyymmdd-nn-slug.md` — date is creation date, never changes.
- Same feature = append Phase, never create a new file.
- `docs/history/template.md` and the `YYYY-MM-DD_phaseN_*.md` files are legacy format — superseded by `/zdoc`; keep, do not extend.

---

## History Index

> Newest first. Load individual files only when needed.
> Legacy files (Phases 0–7) carry 2024 dates in their names/bodies; git shows the work happened 2025-08-27 → 2025-08-30. For legacy rows the Date column uses git dates.

| Date | # | Type | Title | Description | File | Ticket |
|------|---|------|-------|-------------|------|--------|
| 20261020 | 07 | Feature | UI Redesign | Refined Minimal UI, light/dark themes, Bootstrap removed, strict CSP, accessible dialogs/menus | [↗](docs/history/20261020-07-ui-redesign.md) | — |
| 20261020 | 06 | Bug | Functional Bugs + Cleanup | TOTP null on error, period-based refresh, secret cache, search+folder+sort, i18n placeholders, dead code, permissions | [↗](docs/history/20261020-06-functional-bugs-cleanup.md) | — |
| 20261020 | 05 | Bug | Auth Hardening | 600k KDF with migration, lockout, Change PIN, PIN ≥ 6, full lock wipe, no plaintext verifier | [↗](docs/history/20261020-05-auth-hardening.md) | — |
| 20261020 | 04 | Bug | Critical Security Fixes | Export vault loss, stored XSS, CSP, fail-closed storage, import validation, listener duplication | [↗](docs/history/20261020-04-critical-security-fixes.md) | — |
| 20261020 | 03 | Feature | Remove QR Scanning | Content script, context menu and QR parser removed — impl 2025-12-15 (retroactive) | [↗](docs/history/20261020-03-remove-qr-scanning.md) | — |
| 20261020 | 02 | Feature | Open in New Window | Detached 1100×850 window + session auto-login — impl 2025-09-11 / 2025-12-15 (retroactive) | [↗](docs/history/20261020-02-open-in-new-window.md) | — |
| 20261020 | 01 | Feature | Encrypted Export/Import + Icons | Password-protected export, extension icons — impl 2025-09-11; encrypted path broken (retroactive) | [↗](docs/history/20261020-01-encrypted-export-import.md) | — |
| 20250830 | — | Feature | Phase 7 — Storage Unification | All storage on `chrome.storage.local` with dev fallback (legacy) | [↗](docs/history/2024-08-25_phase7_storage_unification.md) | — |
| 20250829 | — | Feature | Phase 6 — Security & Encryption | PIN + verification token, AES-256-GCM; WebAuthn abandoned (legacy) | [↗](docs/history/2024-08-20_phase6_security_encryption.md) | — |
| 20250829 | — | Feature | Phase 5 — Settings & Data Management | Settings modal, JSON export/import, storage stats (legacy) | [↗](docs/history/2024-08-18_phase5_settings_data_management.md) | — |
| 20250829 | — | Feature | Phase 4 — Layout Optimization | Popup width 600 → 850px, compact cards (legacy) | [↗](docs/history/2024-08-15_phase4_layout_optimization.md) | — |
| 20250829 | — | Feature | Phase 3 — Drag & Drop | Delegated drag-and-drop with drop zones (legacy) | [↗](docs/history/2024-08-10_phase3_drag_and_drop.md) | — |
| 20250828 | — | Feature | Phase 2 — UI Improvements | Dropdown account menu, folders, sorting (legacy) | [↗](docs/history/2024-08-05_phase2_ui_improvements.md) | — |
| 20250829 | — | Refactor | Phase 1 — Language Conversion | Arabic → English, `background.js` moved to `js/` (legacy) | [↗](docs/history/2024-08-01_phase1_language_conversion.md) | — |
| 20250827 | — | Feature | Phase 0 — Initial Setup | Web-app foundation, later converted to extension (legacy) | [↗](docs/history/2024-08-26_phase0_initial_project_setup.md) | — |
