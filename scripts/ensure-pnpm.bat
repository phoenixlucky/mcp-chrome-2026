@echo off

where corepack >nul 2>&1
if not errorlevel 1 (
  set "PNPM_CMD=corepack pnpm"
  exit /b 0
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo Node.js 24+ with Corepack or pnpm is required.
  exit /b 1
)

set "PNPM_CMD=pnpm"
exit /b 0
