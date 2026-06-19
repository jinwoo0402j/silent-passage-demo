@echo off
setlocal

set "AI_PORT=4174"
set "AI_MODEL=qwen3:8b"
if "%SILENT_PASSAGE_OLLAMA_MODELS%"=="" (
  if exist "D:\ollama\models" set "SILENT_PASSAGE_OLLAMA_MODELS=D:\ollama\models"
)
if "%SILENT_PASSAGE_AI_MODEL%"=="" set "SILENT_PASSAGE_AI_MODEL=%AI_MODEL%"

call :check_ollama_model
if %ERRORLEVEL% EQU 0 goto check_bridge

echo Starting Ollama for Silent Passage.
echo Model path: %SILENT_PASSAGE_OLLAMA_MODELS%
echo Expected model: %SILENT_PASSAGE_AI_MODEL%
start "Silent Passage Ollama - keep this open" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\start-ollama-local.ps1" -ModelDir "%SILENT_PASSAGE_OLLAMA_MODELS%" -Model "%SILENT_PASSAGE_AI_MODEL%"

for /L %%I in (1,1,15) do (
  timeout /t 1 /nobreak >nul
  call :check_ollama_model
  if not errorlevel 1 goto check_bridge
)

echo.
echo Ollama did not report %SILENT_PASSAGE_AI_MODEL%. The game will still open, but local AI may fall back.

:check_bridge
call :check_ai_bridge
if %ERRORLEVEL% EQU 0 goto open_game

echo Starting Silent Passage local AI bridge on http://127.0.0.1:%AI_PORT%/
echo This expects Ollama to be running on http://127.0.0.1:11434/
echo Default model: %SILENT_PASSAGE_AI_MODEL%
start "Silent Passage AI Bridge - keep this open" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\ai-bridge.ps1" -Port %AI_PORT% -Model "%SILENT_PASSAGE_AI_MODEL%"

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

:check_ollama_model
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 1; if ($r.StatusCode -ge 200) { $m = (($r.Content | ConvertFrom-Json).models | ForEach-Object { $_.name }); if ($m -contains '%SILENT_PASSAGE_AI_MODEL%') { exit 0 } } } catch {}; exit 1" >nul 2>nul
exit /b %ERRORLEVEL%
