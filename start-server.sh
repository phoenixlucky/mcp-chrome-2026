#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

fail() {
  echo "Error: $*" >&2
  exit 1
}

command -v node >/dev/null || fail "Node.js 20 or newer is required."
node_major="$(node -p "process.versions.node.split('.')[0]")"
[ "$node_major" -ge 20 ] || fail "Node.js 20 or newer is required (found $(node -v))."
command -v corepack >/dev/null || fail "Corepack is required; reinstall Node.js 20 or newer."

pnpm() {
  corepack pnpm "$@"
}

echo "========================================"
echo "  Chrome MCP Server v1.9.0"
echo "========================================"
echo

echo "[1/3] Checking dependencies..."
if [ ! -d node_modules ]; then
  pnpm install
else
  echo "Dependencies already installed."
fi
echo "Done."
echo

echo "[2/3] Building app and embedded bridge package..."
pnpm run build:native
pnpm run build:extension
echo "Done."
echo

echo "[3/3] Registering Native Messaging Host..."
pnpm --filter @ethanwilkins/mcp-chrome-bridge-2026 run register:dev || \
  fail "Registration failed. Check that Chrome or Chromium is installed, then rerun this script."
echo

extension_id="$(node -e "process.stdout.write(require('./app/native-server/dist/scripts/constant.js').EXTENSION_ID)" 2>/dev/null || true)"
echo "Setup complete."
[ -n "$extension_id" ] && echo "  Extension ID: $extension_id"
echo "  Reload the Chrome extension, then connect from its popup."
