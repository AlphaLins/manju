@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ===================================================
echo =   Cosmos (原 Toonflow 诗词漫游) 一键启动脚本   =
echo ===================================================

echo [1/2] 正在启动后端服务 (端口 60000)...
start "Cosmos Backend" cmd /k "cd /d "%~dp0Toonflow-app" && npm run dev || pause"

echo [2/2] 正在启动前端服务 (端口 5173)...
start "Cosmos Web" cmd /k "cd /d "%~dp0Toonflow-web" && npm run dev || pause"

echo.
echo 所有服务指令已发出。
echo 两项服务将运行在两个新弹出的黑窗口中。
echo 请不要关闭弹出的窗口，等待前端服务启动完毕后，在浏览器访问：
echo    http://localhost:5173
echo.
pause
