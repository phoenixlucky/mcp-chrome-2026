@echo off
setlocal
cd /d "%~dp0"

call pnpm --filter @ethanwilkins/chrome-mcp-server-2026 zip
if errorlevel 1 (
  echo.
  echo Packaging failed.
  pause
  exit /b 1
)

echo.
echo Packaging complete. ZIP: releases\
pause
