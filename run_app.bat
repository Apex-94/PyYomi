@echo off
echo Starting PyYomi Electron App...
cd /d "%~dp0"
call npm run app:dev
if %errorlevel% neq 0 (
  echo PyYomi failed to start.
  pause
  exit /b %errorlevel%
)
