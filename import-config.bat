@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              导入 AI 模型配置                                 ║
echo ║                                                              ║
echo ║  从 config-backup.json 导入所有 API 密钥和模型配置           ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0Toonflow-app"

if not exist "node_modules" (
    echo ❌ 请先运行 install.bat 安装依赖
    pause
    exit /b 1
)

if not exist "config-backup.json" (
    echo ❌ 未找到 config-backup.json 文件
    echo    请将导出的配置文件放在 Toonflow-app 目录下
    pause
    exit /b 1
)

echo 📥 正在导入配置...
npx tsx scripts/import-config.ts

echo.
pause
