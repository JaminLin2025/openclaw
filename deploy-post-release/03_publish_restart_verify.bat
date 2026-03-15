@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"
set "PROJECT_DIR=%BASE_DIR%\.."

echo [STEP] Publish
cd /d "%PROJECT_DIR%"
call deploy_menu.bat publish
if errorlevel 1 (
  echo [ERROR] Publish failed.
  exit /b 1
)

echo [STEP] Restart
call deploy_menu.bat restart
if errorlevel 1 (
  echo [ERROR] Restart failed.
  exit /b 1
)

echo [STEP] Verify post-release runtime
powershell -NoProfile -ExecutionPolicy Bypass -File "%BASE_DIR%\verify_post_release.ps1" -ProjectDir "%PROJECT_DIR%"
if errorlevel 1 (
  echo [ERROR] Verification failed.
  exit /b 1
)

echo [OK] Publish + Restart + Verification passed.
exit /b 0
