@echo off
REM Production startup script for Admin Pods
REM Starts both API and Web services in production mode

powershell.exe -ExecutionPolicy Bypass -File "%~dp0start-prod.ps1"
