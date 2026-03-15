@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "PROJECT_DIR=%BASE_DIR%\.."

echo [INFO] Running restart only...
cd /d "%PROJECT_DIR%"
call deploy_menu.bat restart
if errorlevel 1 (
  echo [ERROR] Restart failed.
  exit /b 1
)

echo [OK] Restart completed.
exit /b 0
