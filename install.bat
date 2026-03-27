@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         Toonflow (Cosmos) 一键安装脚本                        ║
echo ║                                                              ║
echo ║  此脚本将自动安装前后端所有依赖                               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 检查 Node.js
echo [检查] 正在检测 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 23.x 或更高版本
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%

:: 检查 npm
echo [检查] 正在检测 npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 npm
    pause
    exit /b 1
)
echo ✅ npm 已安装

echo.
echo ────────────────────────────────────────────────────────────────
echo.

:: 安装后端依赖
echo [1/2] 正在安装后端依赖 (Toonflow-app)...
cd /d "%~dp0Toonflow-app"

if exist "package-lock.json" (
    echo    使用 npm ci 安装 (更快)...
    npm ci
) else (
    echo    使用 npm install 安装...
    npm install
)

if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成

echo.

:: 安装前端依赖
echo [2/2] 正在安装前端依赖 (Toonflow-web)...
cd /d "%~dp0Toonflow-web"

if exist "package-lock.json" (
    echo    使用 npm ci 安装 (更快)...
    npm ci
) else (
    echo    使用 npm install 安装...
    npm install
)

if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 前端依赖安装完成

echo.
echo ────────────────────────────────────────────────────────────────
echo.

:: 检查是否有配置备份文件
if exist "%~dp0Toonflow-app\config-backup.json" (
    echo 📋 检测到配置备份文件 (config-backup.json)
    echo.
    set /p IMPORT_CONFIG="是否导入之前的配置? (Y/N): "
    if /i "!IMPORT_CONFIG!"=="Y" (
        cd /d "%~dp0Toonflow-app"
        echo    正在导入配置...
        npx tsx scripts/import-config.ts
    )
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    安装完成!                                  ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  接下来:                                                     ║
echo ║  1. 双击 start.bat 启动服务                                  ║
echo ║  2. 浏览器访问 http://localhost:5173                         ║
echo ║  3. 在系统设置中配置 AI 模型 API 密钥                        ║
echo ║                                                              ║
echo ║  如果已有配置备份，下次可使用:                               ║
echo ║  - 导出: npx tsx scripts/export-config.ts                    ║
echo ║  - 导入: npx tsx scripts/import-config.ts                    ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"
pause
