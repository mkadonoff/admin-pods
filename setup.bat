@echo off
REM Setup script for admin-pods development environment (Windows)
REM This script automates the initial setup of both API and Web projects

setlocal enabledelayedexpansion

echo ===================================
echo Admin Pods Setup Script
echo ===================================
echo.

REM Check prerequisites
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm is not installed. Please install npm first.
    exit /b 1
)

echo SUCCESS: Node.js and npm found
echo.

REM Setup API
echo Setting up API...
cd api

if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env
    echo WARNING: Please update api\.env with your SQL Server connection string
    echo Example: DATABASE_URL="Server=localhost;Database=admin_pods;User=sa;Password=YourPassword123;TrustServerCertificate=true"
)

echo Installing API dependencies...
call npm install

echo.
echo Setting up database schema...
call npm run prisma:generate

echo SUCCESS: API setup complete
echo.

REM Setup Web
cd ..\web

echo Setting up Web...
echo Installing Web dependencies...
call npm install

echo SUCCESS: Web setup complete
echo.

cd ..

echo ===================================
echo Setup Complete! ===
echo ===================================
echo.
echo Next steps:
echo.
echo 1. Configure your database:
echo    - Edit api\.env with your SQL Server connection
echo    - Run: cd api ^&^& npm run prisma:migrate init
echo.
echo 2. Start the servers (in separate terminals):
echo    - API:  cd api ^&^& npm run dev  ^(port 3000^)
echo    - Web:  cd web ^&^& npm run dev  ^(port 5173^)
echo.
echo 3. Open http://localhost:5173 in your browser
echo.
echo Documentation:
echo   - Quick start:    Read QUICKSTART.md
echo   - Full overview:  Read README.md
echo   - For AI agents:  Read .github\copilot-instructions.md
echo   - Data flow:      Read DATA_FLOW.md
echo.
pause
