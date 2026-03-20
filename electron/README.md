# Pyyomi Electron Edition

Alternative desktop packaging using Electron instead of Tauri.

## Quick Start

```bash
# From the repo root, bootstrap and launch the desktop app
npm run app:dev

# Build the Windows release installer
npm run app:release:win

# Build for macOS
cd electron
npm run build:mac

# Build for Linux
npm run build:linux

# Build for all platforms
npm run build:all
```

## Features

- Auto-starts Python backend (FastAPI) on port 8000
- Auto-starts frontend dev server on port 3000
- Loads app in Electron window
- Cross-platform: Windows, macOS, Linux

## Requirements

- Node.js 18+
- Python 3.10+
- npm or yarn

## Output

Build artifacts are in `electron/release-electron/`:
- Windows: `.exe` installer
- macOS: `.dmg` disk image
- Linux: `.AppImage`

The canonical app version is stored in `release.json` at the repo root and synced into Electron metadata before packaging.

## Comparison with Tauri

| Feature | Tauri | Electron |
|---------|-------|----------|
| Size | ~50MB | ~150MB |
| Performance | Faster | Slower |
| Native UI | Yes | Web-based |
| Python Backend | Bundled | Bundled |
| Cross-platform | Yes | Yes |
| Development | Harder | Easier |

## Troubleshooting

### Backend won't start

Make sure Python is in PATH:
```bash
python --version
```

### Frontend won't start

Make sure Node.js is installed:
```bash
node --version
npm --version
```

### Build fails

Clear caches:
```bash
# Windows
rd /s /q node_modules
rd /s /q dist
del package-lock.json

# Recreate
npm install
npm run build:win
```
