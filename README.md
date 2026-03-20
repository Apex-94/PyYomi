# PyYomi

PyYomi is an Electron desktop manga reader with a local FastAPI backend.

This app is designed for:
- Browsing manga from supported sources
- Saving manga to your Library
- Reading in single-page or scroll mode
- Downloading chapters for offline reading
- Managing download paths and cache settings

## What You Can Do

- Browse latest/popular/search manga from active source
- Add manga to Library and organize categories
- Open manga details, chapter list, and chapter downloads
- Read chapters with keyboard navigation
- Queue, pause, resume, cancel, and delete chapter downloads
- Set custom download folder with structure:
  - `/path/<manga-name>/<chapter>/<pages>`
- Use metadata image caching for faster repeat loads

## Install (Recommended)

1. Go to Releases: `https://github.com/Apex-94/PyYomi/releases`
2. Download latest Windows installer:
   - `Pyyomi-<version>-Electron-win.exe`
3. Run installer and complete setup.
4. Launch `Pyyomi Manga Reader`.

## Build From Source (Windows)

### Prerequisites

- Node.js 20+
- Python 3.11+ (project currently builds with local venv + PyInstaller)
- Git

### Clone and install

```powershell
git clone https://github.com/Apex-94/PyYomi.git
cd PyYomi
npm run app:dev
```

### Run desktop app in dev mode

```powershell
npm run app:dev
```

### Build release installer

```powershell
npm run app:release:win
```

Output installer is created in:
- `electron/release-electron/`

## First Run Setup

1. Open `Sources` page.
2. Select your preferred source.
3. Go to `Browse` and search/open a manga.
4. Add manga to `Library`.
5. Open a chapter in `Reader`.
6. Optional: open `Settings` and set a custom download path.

## Main Sections

### Browse

- Search and filter manga from current source
- Switch between latest/popular/random
- Add directly to Library

### Manga Details

- View cover, description, author/artist/status/genres
- Open chapter list
- Download chapter
- Delete downloaded chapter files (per chapter)

### Library

- View saved manga list
- Open manga quickly
- Remove manga from Library
- Manage categories

### Downloads

- Track queued/active/completed/failed downloads
- Pause, resume, cancel
- Delete downloaded files and clear DB record for that chapter download item

### Reader

- Single mode and scroll mode
- Direction toggle (LTR/RTL)
- Loading guard to prevent stale previous-page image on page switch
- Auto-fit behavior for very tall pages

## Reader Controls

- `ArrowRight` / `ArrowLeft`: next/previous page (direction-aware)
- `ArrowDown` / `ArrowUp`: scroll in scroll mode
- `F`: toggle top controls
- `Esc`: show controls

## Download Path and File Layout

Set in `Settings`:
- `Download Path`

Download folders are saved as:
- `/your/path/<manga-slug>/Chapter_###__<chapter-title-slug>/<001.ext>`

## Caching

PyYomi supports backend image metadata caching for covers/thumbnails.
Configurable in `Settings`:
- Cache enabled
- Max bytes
- TTL hours

## Data and Logs

Desktop runtime keeps backend data/logs under app user data directories.
Typical locations include backend DB and logs used by Electron-managed backend runtime.

If troubleshooting, check:
- Electron main log location printed by app startup errors
- Backend log file under backend data dir

## Troubleshooting

### Chapter download fails immediately

- Confirm source is selected and available on `Sources` page
- Retry download from manga details
- Check Downloads error text

### Reader shows wrong page briefly

- Ensure latest version (`v1.0.1+`)
- Reader now blocks old frame and shows loading until new page is ready

### Installer builds but release assets are missing online

- Git tag alone is not enough; a GitHub Release object must exist
- Attach generated `.exe` and `.blockmap` to release if workflow did not publish

## Project Structure

- `frontend/`: React + Vite UI
- `backend/`: FastAPI, SQLModel, source extensions, download manager
- `electron/`: Desktop shell and packaging
- `docs/`: architecture and extension docs

## Notes for Maintainers

- Canonical app version lives in `release.json`
- Sync Electron package metadata locally with `npm run version:sync`
- Create releases from GitHub Actions via `.github/workflows/release-electron.yml`
- The legacy `.github/workflows/auto-version-tag.yml` no longer creates tags automatically
- Electron artifact names and runtime version are synced from `release.json`

## License

Apache-2.0
