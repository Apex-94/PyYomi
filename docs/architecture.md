# Architecture (Electron-first)

## Overview

PyYomi is a three-layer application:

1. `frontend/` (React + Vite + MUI)
2. `backend/` (FastAPI + SQLModel + source extensions)
3. `electron/` (desktop shell, process lifecycle, packaging)

The legacy Tauri runtime has been removed from active source paths.

## Runtime model

- Electron launches and supervises backend process.
- Electron preload injects backend URL into renderer (`window.__BACKEND_URL__`).
- Frontend API client consumes injected URL and falls back to local backend URL when needed.

## Data flow

1. User action in frontend (Browse/Library/Reader).
2. Frontend calls backend REST API (`/api/v1/*`).
3. Backend fetches local DB data and/or source extension scraping results.
4. Response rendered in frontend.

### Progressive global search flow

Global search now uses a session-based polling model instead of one blocking merged request:

1. Frontend creates a session with `POST /api/v1/manga/search/global/sessions`.
2. Backend spawns concurrent per-source searches with bounded concurrency and per-source timeout.
3. Frontend polls `GET /api/v1/manga/search/global/sessions/{session_id}`.
4. UI renders completed sources immediately as source lanes while pending/running sources remain in summary state.

The legacy `GET /api/v1/manga/search/global` endpoint remains available as a compatibility fallback, but the browse UI no longer relies on it.

## Backend modules

- `app/api/`: API routers (`library`, `manga`, `sources`, `categories`, etc.)
- `app/db/`: models/session/migrations
- `app/extensions/`: source plugins and loader registry
- `app/services/global_search.py`: in-memory progressive global-search session manager

## Frontend modules

- `src/app/`: pages
- `src/components/`: reusable UI
- `src/lib/api.ts`: axios base config and API helpers
- `src/hooks/`: shared state hooks

### Browse search behavior

- Source search stays request/response based and uses the active source.
- Global search uses a dedicated search-desk surface and progressive source lanes.
- AniList enrichment is deferred per finished lane so base search results render before metadata decoration.

## Desktop packaging

- `electron-builder` packages app and bundles:
  - backend executable (`backend/dist/pyyomi-backend.exe`)
  - built frontend (`frontend/dist`)
- Icons live in `electron/assets/icons`.

## CI and release automation

- `ci.yml`: typecheck/build/package smoke checks
- `auto-version-tag.yml`: deprecated placeholder kept to avoid accidental auto-tagging
- `release-electron.yml`: manually bumps version, tags, builds, and publishes Windows release assets

## Version source of truth

- `release.json` is the single authoritative app version.
- `scripts/app-cli.js` syncs that version into Electron package metadata before packaging.
- Electron preload reads the packaged app version from the running app metadata, not a hardcoded file path.

## Current constraints

- Windows build is primary validated release target.
- Large frontend bundle warning exists; code splitting can be addressed separately.
- Progressive global search sessions are stored in-process in backend memory, which is acceptable for the current single-process desktop runtime.
