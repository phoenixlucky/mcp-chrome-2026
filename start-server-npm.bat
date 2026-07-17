@echo off
setlocal enabledelayedexpansion
title Chrome MCP Server - npm Launcher
cd /d "%~dp0"

echo ========================================
echo   Chrome MCP Server v1.3.3 -- npm
echo ========================================
echo.

echo [1/4] Checking dependencies...
if not exist "node_modules" (
    call pnpm install
    if %ERRORLEVEL% NEQ 0 (
        echo Install failed
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)
echo Done.
echo.

echo [2/4] Building shared package...
call npm run -w @ethanwilkins/chrome-mcp-shared-2026 build
if %ERRORLEVEL% NEQ 0 (
    echo Build shared failed
    pause
    exit /b 1
)
echo Done.
echo.

echo [3/4] Building and registering native-server...
echo [Tip] If native-server\dist reports EPERM, close Chrome and rerun this script.
call npm run -w @ethanwilkins/mcp-chrome-bridge-2026 build
if %ERRORLEVEL% NEQ 0 (
    echo Build native-server failed
    pause
    exit /b 1
)
call npm run -w @ethanwilkins/chrome-mcp-server-2026 build
if %ERRORLEVEL% NEQ 0 (
    echo Build extension failed
    pause
    exit /b 1
)

call npm run -w @ethanwilkins/mcp-chrome-bridge-2026 register:dev
if %ERRORLEVEL% NEQ 0 (
    echo Register failed - may need admin rights.
    echo Run manually: npm run -w @ethanwilkins/mcp-chrome-bridge-2026 register:dev
) else (
    echo Register OK.
)
echo.

echo [4/4] Clearing stale HTTP processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":12306 " ^| findstr "LISTENING"') do (
    echo   Killing PID %%a ...
    taskkill /F /PID %%a >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo   Port 12306 freed.
    )
)
echo.

echo Setup complete.
for /f %%i in ('node -e "process.stdout.write(require('./app/native-server/dist/scripts/constant.js').EXTENSION_ID)"') do set EXTENSION_ID=%%i
echo   Extension ID: !EXTENSION_ID!
echo.
echo   Reload the Chrome extension, then connect from its popup.
echo ========================================
pause
