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
echo 所有服务正在启动中...
echo 浏览器将自动打开 http://localhost:5173

:: 等待前端服务启动（最多等待 30 秒）
echo 等待前端服务启动...
for /L %%i in (1,1,30) do (
    curl -s -o nul -w "" http://localhost:5173 >nul 2>&1 && goto :service_ready
    timeout /t 1 >nul
)
echo 警告：前端服务可能未正常启动，请手动检查
goto :end

:service_ready
echo 前端服务已就绪，正在打开浏览器...
start "" http://localhost:5173

:end
echo.
echo 访问地址: http://localhost:5173
pause
