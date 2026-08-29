@echo off
setlocal
cd /d "%~dp0"

call "%~dp0scripts\ensure-pnpm.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

set "VERSION="
for /f "delims=" %%V in ('powershell -NoProfile -NonInteractive -Command "(Get-Content -Raw 'package.json' | ConvertFrom-Json).version"') do set "VERSION=%%V"
if not defined VERSION (
  echo Unable to read the project version from package.json.
  pause
  exit /b 1
)

echo Checking locked dependencies...
call %PNPM_CMD% install --frozen-lockfile
if errorlevel 1 (
  echo.
  echo Dependency installation failed. Check pnpm and network settings.
  pause
  exit /b 1
)

echo.
echo Packaging Chrome MCP Bridge %VERSION% for Windows x64...
echo Output: releases\chrome-mcp-bridge-%VERSION%-win-x64.exe
echo.

call %PNPM_CMD% run package:windows
if errorlevel 1 (
  echo.
  echo Windows EXE packaging failed.
  pause
  exit /b 1
)

echo.
echo Packaging complete: releases\chrome-mcp-bridge-%VERSION%-win-x64.exe
pause
exit /b 0
