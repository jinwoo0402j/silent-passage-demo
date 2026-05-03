@echo off
setlocal

set "PORT=4173"
set "PAGE=%~1"

if "%PAGE%"=="" set "PAGE=level-design.html"

cd /d "%~dp0.."

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>nul
if %ERRORLEVEL% EQU 0 goto open_page

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "Silent Passage Local Server" /min py -3 -m http.server %PORT% --bind 127.0.0.1
  goto wait_server
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "Silent Passage Local Server" /min python -m http.server %PORT% --bind 127.0.0.1
  goto wait_server
)

echo Python is required to run the local editor server.
echo Install Python, then double-click this file again.
pause
exit /b 1

:wait_server
timeout /t 1 /nobreak >nul

:open_page
start "" "http://localhost:%PORT%/%PAGE%"
endlocal

