@echo off
rem MuseMark launcher
cd /d "%~dp0"
if exist "src-tauri\target\release\musemark.exe" (
  start "" "src-tauri\target\release\musemark.exe" %*
) else (
  call npm start -- %*
)
