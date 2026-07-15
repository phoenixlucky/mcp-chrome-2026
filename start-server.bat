@echo off
title Chrome MCP Server - 本地服务
echo ========================================
echo   Chrome MCP Server v1.1.2
echo   正在启动本地服务...
echo ========================================
echo.

cd /d "%~dp0"

node app/native-server/dist/index.js

echo.
echo 服务已停止，按任意键退出...
pause >nul
