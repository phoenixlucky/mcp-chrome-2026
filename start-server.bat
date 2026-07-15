@echo off
title Chrome MCP Server - Launcher
cd /d "%~dp0"

echo ========================================
echo   Chrome MCP Server v1.2.3
echo ========================================
echo.

echo [1/4] Installing dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo Install failed
    pause
    exit /b 1
)
echo Done.
echo.

echo [2/4] Building packages (shared + native-server)...
call pnpm run build:shared
if %ERRORLEVEL% NEQ 0 (
    echo Build shared failed, check dependencies
    pause
    exit /b 1
)
call pnpm run build:native
if %ERRORLEVEL% NEQ 0 (
    echo Build native-server failed, check dependencies
    pause
    exit /b 1
)
echo Done.
echo.

echo [3/4] Registering Native Messaging Host...
call pnpm --filter @ethanwilkins/mcp-chrome-bridge-2026 run register:dev
if %ERRORLEVEL% NEQ 0 (
    echo Register failed - may need admin rights.
    echo Run as admin or manually: pnpm --filter @ethanwilkins/mcp-chrome-bridge-2026 register:dev
) else (
    echo Registered OK.
)
echo.

echo [4/4] Starting Native Host (waiting for Chrome extension)...
echo.
echo   Native Host will serve on port 12306 via HTTP/MCP
echo   Press Ctrl+C to stop
echo ========================================
echo.

node app/native-server/dist/cli.js start

echo.
echo Server stopped.
pause
