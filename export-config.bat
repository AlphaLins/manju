@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              导出 AI 模型配置                                 ║
echo ║                                                              ║
echo ║  将所有 API 密钥和模型配置导出到 config-backup.json          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0Toonflow-app"

if not exist "node_modules" (
    echo ❌ 请先运行 install.bat 安装依赖
    pause
    exit /b 1
)

echo 📤 正在导出配置...
npx tsx scripts/export-config.ts

echo.
pause
