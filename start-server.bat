@echo off
title Chrome MCP Server - 启动器
cd /d "%~dp0"

echo ========================================
echo   Chrome MCP Server v1.2.2 — 一键启动
echo ========================================
echo.

echo [1/4] 安装依赖...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo 安装依赖失败
    pause
    exit /b 1
)
echo 依赖安装完成。
echo.

echo [2/4] 构建依赖包（shared + native-server）...
call pnpm run build:shared
if %ERRORLEVEL% NEQ 0 (
    echo 构建 shared 失败，请检查依赖
    pause
    exit /b 1
)
call pnpm run build:native
if %ERRORLEVEL% NEQ 0 (
    echo 构建 native-server 失败，请检查依赖
    pause
    exit /b 1
)
echo 构建完成。
echo.

echo [3/4] 注册 Native Messaging Host...
call pnpm --filter mcp-chrome-bridge run register:dev
if %ERRORLEVEL% NEQ 0 (
    echo 注册失败，可能需要管理员权限。
    echo 请右键以管理员身份运行本脚本，或手动执行：
    echo   pnpm --filter mcp-chrome-bridge register:dev
) else (
    echo 注册成功。
)
echo.

echo [4/4] 启动本地 Native Host（等待 Chrome 扩展连接）...
echo.
echo   提示：Native Host 启动后，会在端口 12306 提供 HTTP/MCP 服务
echo         请确保 Chrome 扩展已加载，扩展会自动连接本服务
echo.
echo   按 Ctrl+C 停止服务
echo ========================================
echo.

node app/native-server/dist/index.js

echo.
echo 服务已停止。
pause
