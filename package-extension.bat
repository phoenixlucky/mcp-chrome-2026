@echo off
setlocal
cd /d "%~dp0"

call "%~dp0scripts\ensure-pnpm.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Current extension version:
powershell -NoProfile -Command "(Get-Content -Raw 'app/chrome-extension/package.json' | ConvertFrom-Json).version"
echo.
echo Choose version handling:
echo   0. Keep current version
echo   1. Increase major version and reset lower parts   ^(x.0.0^)
echo   2. Increase minor version and reset patch        ^(x.y.0^)
echo   3. Increase patch version                         ^(x.y.z^)
set /p "VERSION_CHOICE=Choice [0]: "
if "%VERSION_CHOICE%"=="" set "VERSION_CHOICE=0"

if "%VERSION_CHOICE%"=="0" goto :build
if "%VERSION_CHOICE%"=="1" set "VERSION_PART=major"
if "%VERSION_CHOICE%"=="2" set "VERSION_PART=minor"
if "%VERSION_CHOICE%"=="3" set "VERSION_PART=patch"
if not defined VERSION_PART (
  echo Invalid choice.
  pause
  exit /b 1
)

call %PNPM_CMD% --filter @ethanwilkins/chrome-mcp-server-2026 version %VERSION_PART% --no-git-tag-version --no-git-checks
if errorlevel 1 (
  echo.
  echo Version update failed.
  pause
  exit /b 1
)

:build
call %PNPM_CMD% --filter @ethanwilkins/chrome-mcp-shared-2026 build
if errorlevel 1 (
  echo.
  echo Extension dependency build failed.
  pause
  exit /b 1
)

call %PNPM_CMD% --filter @ethanwilkins/chrome-mcp-server-2026 zip
if errorlevel 1 (
  echo.
  echo Packaging failed.
  pause
  exit /b 1
)

echo.
echo Packaging complete. ZIP: releases\
pause
exit /b 0
