@echo off
setlocal

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :60000') do (
  echo Killing PID %%a on port 60000...
  taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
  echo Killing PID %%a on port 5173...
  taskkill /PID %%a /F >nul 2>&1
)

endlocal
