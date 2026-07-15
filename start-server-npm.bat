@echo off
title Chrome MCP Server - npm Launcher
cd /d "%~dp0"

echo ========================================
echo   Chrome MCP Server v1.2.2 -- npm
echo ========================================
echo.

echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Install failed
    pause
    exit /b 1
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
call npm run -w @ethanwilkins/mcp-chrome-bridge-2026 build
if %ERRORLEVEL% NEQ 0 (
    echo Build native-server failed
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

echo [4/4] Starting Native Host (waiting for Chrome extension)...
echo.
echo   Native Host will serve on port 12306 via HTTP/MCP
echo   Press Ctrl+C to stop
echo ========================================
echo.

node app/native-server/dist/index.js

echo.
echo Server stopped.
pause
