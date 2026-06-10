@echo off
echo ===================================================
echo               STARTING BILLMANAGER
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this PC!
    echo Please download and install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b
)

:: Check if node_modules exists, install dependencies if missing
if not exist node_modules (
    echo [INFO] First-time setup: Installing dependencies...
    echo This may take a couple of minutes. Please wait...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Check your internet connection.
        pause
        exit /b
    )
)

echo.
echo [INFO] Starting local development server...
echo The application will open automatically in your browser.
echo Keep this window open while using the application.
echo.

:: Start SvelteKit and open browser
call npm run dev -- --open

pause
