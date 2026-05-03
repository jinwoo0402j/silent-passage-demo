@echo off
setlocal

set "PORT=4173"
set "PAGE=%~1"
set "ROOT=%~dp0.."

if "%PAGE%"=="" set "PAGE=level-design.html"

cd /d "%ROOT%"

call :check_server
if %ERRORLEVEL% EQU 0 goto open_page

set "PYTHON_CMD="

py -3 -c "import sys" >nul 2>nul
if %ERRORLEVEL% EQU 0 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
  python -c "import sys" >nul 2>nul
  if %ERRORLEVEL% EQU 0 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD goto missing_python

echo Starting Silent Passage local server on http://localhost:%PORT%/
echo Leave the server window open while editing levels.
start "Silent Passage Local Server - keep this open" cmd /k "%PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1"

for /L %%I in (1,1,12) do (
  timeout /t 1 /nobreak >nul
  call :check_server
  if not errorlevel 1 goto open_page
)

echo.
echo The local server did not respond on http://localhost:%PORT%/
echo Check the server window for the exact error.
echo Common fixes:
echo - Install Python from https://www.python.org/downloads/
echo - Enable "Add python.exe to PATH" during installation
echo - Close anything else using port %PORT%
pause
exit /b 1

:open_page
start "" "http://localhost:%PORT%/%PAGE%"
endlocal
exit /b 0

:missing_python
echo.
echo Python is required to run the local editor server.
echo Install Python from:
echo https://www.python.org/downloads/
echo.
echo During installation, enable:
echo Add python.exe to PATH
pause
exit /b 1

:check_server
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/index.html' -TimeoutSec 1; if ($r.StatusCode -ge 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
exit /b %ERRORLEVEL%

