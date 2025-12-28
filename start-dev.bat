@echo off
setlocal

REM Starts both dev servers (API + Web) and opens the React app.

set "SCRIPT_DIR=%~dp0"

where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: PowerShell was not found on PATH.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-dev.ps1"
