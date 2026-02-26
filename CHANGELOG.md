# Changelog

All notable changes to this project are documented in this file.

## v1.0.2 - 2026-02-26

### Added
- AniList detailed entry management endpoints:
  - `GET /api/v1/trackers/{tracker}/entry`
  - `PUT /api/v1/trackers/{tracker}/entry`
- AniList tracker entry editing UI in the mapping dialog:
  - progress
  - status
  - score
  - privacy
  - started/completed dates
- Optional tracker status metadata (`score_format`) in tracker status response.
- Persistent local encryption key fallback at `backend/.encryption_key` when `ENCRYPTION_KEY` is not set.

### Changed
- AniList sync payload now supports richer fields (`status`, `score`, `is_private`, `started_at`, `completed_at`).
- AniList auto-status behavior now defaults to enabled during sync.

### Fixed
- OAuth/token handling in Electron callback flow and tracker sync behavior.
- Token decryption failures now return a clean `401` reconnect-required response instead of `500` crashes.
- Improved tracker OAuth flow behavior consistency for AniList and MAL integration paths.

### Release Notes
- Tag `v1.0.2` triggers `.github/workflows/release-electron.yml`, which builds and publishes Windows installer assets (`.exe` + `.blockmap`) to the GitHub Release.
