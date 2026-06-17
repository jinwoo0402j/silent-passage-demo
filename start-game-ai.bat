@echo off
setlocal

set "AI_PORT=4174"

call :check_ai_bridge
if %ERRORLEVEL% EQU 0 goto open_game

echo Starting Silent Passage local AI bridge on http://127.0.0.1:%AI_PORT%/
echo This expects Ollama to be running on http://127.0.0.1:11434/
echo Default model: qwen2.5:3b
start "Silent Passage AI Bridge - keep this open" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\ai-bridge.ps1" -Port %AI_PORT%

for /L %%I in (1,1,8) do (
  timeout /t 1 /nobreak >nul
  call :check_ai_bridge
  if not errorlevel 1 goto open_game
)

echo.
echo The AI bridge did not respond. The game will still open with fallback dialogue.

:open_game
call "%~dp0scripts\open-local.bat" "index.html?ai=local^&tts=on"
endlocal
exit /b 0

:check_ai_bridge
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%AI_PORT%/health' -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.Content -match 'silent-passage-ai-bridge') { exit 0 } } catch {}; exit 1" >nul 2>nul
exit /b %ERRORLEVEL%
