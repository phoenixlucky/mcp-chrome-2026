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

:select-builds
echo.
echo Select targets to build. Enter multiple numbers separated by commas, or press Enter for all:
echo [1] Desktop client (reuses the existing bridge when available)
echo [2] Bridge runtime
echo [3] Chrome extension
set "SELECTION="
set /p "SELECTION=Selection: "
if not defined SELECTION set "SELECTION=123"
set "SELECTION=%SELECTION: =%"
set "SELECTION=%SELECTION:,=%"
if /i "%SELECTION%"=="A" set "SELECTION=123"

rem Validate the normalized selection before testing individual targets. The
rem previous substitution-based check can be expanded against the wrong value
rem by cmd.exe when this block is invoked from another batch file.
echo(%SELECTION%|%SystemRoot%\System32\findstr.exe /r /x "[123][123]*" >nul
if errorlevel 1 (
  echo Invalid selection. Use 1, 2, 3, or combinations such as 1,3.
  goto select-builds
)

set "BUILD_DESKTOP="
set "BUILD_BRIDGE="
set "BUILD_EXTENSION="
if not "%SELECTION:1=%"=="%SELECTION%" set "BUILD_DESKTOP=1"
if not "%SELECTION:2=%"=="%SELECTION%" set "BUILD_BRIDGE=1"
if not "%SELECTION:3=%"=="%SELECTION%" set "BUILD_EXTENSION=1"

if not defined BUILD_DESKTOP if not defined BUILD_BRIDGE if not defined BUILD_EXTENSION (
  echo Please select at least one target.
  goto select-builds
)

set "NEEDS_BRIDGE_BUILD="
if defined BUILD_BRIDGE set "NEEDS_BRIDGE_BUILD=1"
if defined BUILD_DESKTOP if not exist "%~dp0app\desktop-client\bridge\chrome-mcp-bridge.exe" set "NEEDS_BRIDGE_BUILD=1"

echo Checking locked dependencies...
call %PNPM_CMD% install --frozen-lockfile
if errorlevel 1 (
  echo.
  echo Dependency installation failed. Check pnpm and network settings.
  pause
  exit /b 1
)

call %PNPM_CMD% run check:versions
if errorlevel 1 (
  echo.
  echo Version check failed.
  pause
  exit /b 1
)

set "RELEASE_DIR=%~dp0releases"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

if defined BUILD_DESKTOP del /q "%RELEASE_DIR%\Chrome MCP Bridge_*.msi" 2>nul
if defined BUILD_DESKTOP del /q "%RELEASE_DIR%\Chrome MCP Bridge_*-setup.exe" 2>nul
if defined BUILD_BRIDGE del /q "%RELEASE_DIR%\chrome-mcp-bridge-*-win-x64.exe" 2>nul

if defined NEEDS_BRIDGE_BUILD (
  echo.
  echo Packaging Bridge runtime...
  call %PNPM_CMD% run package:windows
  if errorlevel 1 (
    echo.
    echo Bridge runtime packaging failed.
    pause
    exit /b 1
  )
)

if defined BUILD_DESKTOP (
  if defined NEEDS_BRIDGE_BUILD (
    call node scripts\prepare-tauri-bridge.mjs
    if errorlevel 1 (
      echo.
      echo Failed to prepare the Tauri bridge.
      pause
      exit /b 1
    )
  )
  echo.
  echo Packaging Chrome MCP Bridge desktop client %VERSION% for Windows x64...
  echo This includes the bridge runtime and the Tauri 2 + Vue client.
  echo.
  call %PNPM_CMD% --filter @ethanwilkins/chrome-mcp-desktop-2026 tauri:build
  if errorlevel 1 (
    echo.
    echo Desktop client packaging failed.
    pause
    exit /b 1
  )
)

if defined BUILD_EXTENSION (
  echo.
  echo Packaging Chrome extension ZIP...
  call %PNPM_CMD% --filter @ethanwilkins/chrome-mcp-server-2026 zip
  if errorlevel 1 (
    echo.
    echo Chrome extension packaging failed.
    pause
    exit /b 1
  )
)

if defined BUILD_DESKTOP (
  copy /y "%~dp0app\desktop-client\src-tauri\target\release\chrome-mcp-desktop.exe" "%RELEASE_DIR%\chrome-mcp-desktop-%VERSION%-win-x64.exe" >nul
  if errorlevel 1 (
    echo.
    echo Failed to copy the desktop client into releases\.
    pause
    exit /b 1
  )
)

if defined BUILD_BRIDGE (
  copy /y "%RELEASE_DIR%\chrome-mcp-bridge-%VERSION%-win-x64.exe" "%RELEASE_DIR%\chrome-mcp-bridge.exe" >nul
  if errorlevel 1 (
    echo.
    echo Failed to copy the bridge runtime into releases\.
    pause
    exit /b 1
  )
)

if defined BUILD_EXTENSION (
  copy /y "%~dp0app\chrome-extension\.output\chrome-mcp-server-%VERSION%-chrome.zip" "%RELEASE_DIR%\chrome-mcp-server-%VERSION%-chrome.zip" >nul
  if errorlevel 1 (
    echo.
    echo Failed to copy the Chrome extension package into releases\.
    pause
    exit /b 1
  )
)

rem The bridge built only as a desktop dependency is already bundled into the desktop client.
if defined BUILD_DESKTOP if not defined BUILD_BRIDGE if defined NEEDS_BRIDGE_BUILD del /q "%RELEASE_DIR%\chrome-mcp-bridge-%VERSION%-win-x64.exe" 2>nul

echo.
echo Packaging complete.
echo Output folder: releases\
if defined BUILD_DESKTOP echo Desktop EXE: releases\chrome-mcp-desktop-%VERSION%-win-x64.exe
if defined BUILD_BRIDGE echo Bridge runtime: releases\chrome-mcp-bridge.exe
if defined BUILD_EXTENSION echo Chrome extension: releases\chrome-mcp-server-%VERSION%-chrome.zip
pause
exit /b 0
