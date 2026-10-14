@echo off
rem MuseMark launcher
cd /d "%~dp0"
if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" .
) else (
  echo [MuseMark] Electron runtime not found.
  echo [MuseMark] Run: npm install
  pause
)
