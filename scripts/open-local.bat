@echo off
setlocal

set "PORT=4173"
set "PAGE=%~1"
set "ROOT=%~dp0.."

if "%PAGE%"=="" set "PAGE=level-design.html"

cd /d "%ROOT%"

call :check_custom_server
if %ERRORLEVEL% EQU 0 goto open_page

call :check_any_server
if %ERRORLEVEL% EQU 0 (
  echo.
  echo Port %PORT% is already in use by another local server.
  echo Close the old server window, then run this launcher again.
  echo Silent Passage needs its bundled server so level JSON files under levels/drafts are discovered automatically.
  pause
  exit /b 1
)

echo Starting Silent Passage local server on http://localhost:%PORT%/
echo Leave the server window open while editing levels.
echo This bundled server auto-discovers levels/drafts and levels/accepted.
start "Silent Passage Local Server - keep this open" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0serve-local.ps1" -Root "%CD%" -Port %PORT%

for /L %%I in (1,1,12) do (
  timeout /t 1 /nobreak >nul
  call :check_custom_server
  if not errorlevel 1 goto open_page
)

echo.
echo The local server did not respond on http://localhost:%PORT%/
echo Check the server window for the exact error.
echo Common fixes:
echo - If Windows blocked PowerShell scripts, run this launcher again.
echo - Close anything else using port %PORT%
pause
exit /b 1

:open_page
start "" "http://localhost:%PORT%/%PAGE%"
endlocal
exit /b 0

:check_custom_server
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/__silent-passage-server' -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.Content -match 'silent-passage-local-server') { exit 0 } } catch {}; exit 1" >nul 2>nul
exit /b %ERRORLEVEL%

:check_any_server
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/index.html' -TimeoutSec 1; if ($r.StatusCode -ge 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
exit /b %ERRORLEVEL%
