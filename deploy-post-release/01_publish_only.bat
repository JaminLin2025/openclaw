@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "PROJECT_DIR=%BASE_DIR%\.."

echo [INFO] Running publish only...
cd /d "%PROJECT_DIR%"
call deploy_menu.bat publish
if errorlevel 1 (
  echo [ERROR] Publish failed.
  exit /b 1
)

echo [OK] Publish completed.
exit /b 0
