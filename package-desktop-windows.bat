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
echo Packaging Chrome MCP Bridge desktop client %VERSION% for Windows x64...
echo This includes the bridge runtime and the Tauri 2 + Vue client.
echo.

call %PNPM_CMD% run package:desktop:windows
if errorlevel 1 (
  echo.
  echo Desktop client packaging failed.
  pause
  exit /b 1
)

set "RELEASE_DIR=%~dp0releases"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

copy /y "%~dp0app\desktop-client\src-tauri\target\release\chrome-mcp-desktop.exe" "%RELEASE_DIR%\chrome-mcp-desktop-%VERSION%-win-x64.exe" >nul
if errorlevel 1 (
  echo.
  echo Failed to copy the desktop client into releases\.
  pause
  exit /b 1
)

copy /y "%~dp0app\desktop-client\bridge\chrome-mcp-bridge.exe" "%RELEASE_DIR%\chrome-mcp-bridge.exe" >nul
if errorlevel 1 (
  echo.
  echo Failed to copy the bridge runtime into releases\.
  pause
  exit /b 1
)

for /r "%~dp0app\desktop-client\src-tauri\target\release\bundle" %%F in (*.exe *.msi) do copy /y "%%F" "%RELEASE_DIR%" >nul

echo.
echo Desktop client packaging complete.
echo Output folder: releases\
echo Desktop EXE: releases\chrome-mcp-desktop-%VERSION%-win-x64.exe
echo Bridge runtime: releases\chrome-mcp-bridge.exe
echo Installers: copied into releases\ when generated
pause
exit /b 0
