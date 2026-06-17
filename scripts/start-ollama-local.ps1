param(
  [string]$ModelDir = $env:SILENT_PASSAGE_OLLAMA_MODELS,
  [string]$Model = "qwen3:8b",
  [string]$OllamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
  [string]$HostUrl = "http://127.0.0.1:11434"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ModelDir)) {
  if (Test-Path -LiteralPath "D:\ollama\models") {
    $ModelDir = "D:\ollama\models"
  } else {
    $ModelDir = Join-Path $env:USERPROFILE ".ollama\models"
  }
}

function Test-OllamaModel {
  param(
    [string]$ExpectedModel
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$HostUrl/api/tags" -TimeoutSec 2
    if ($response.StatusCode -lt 200) {
      return $false
    }
    $payload = $response.Content | ConvertFrom-Json
    return @($payload.models | ForEach-Object { $_.name }) -contains $ExpectedModel
  } catch {
    return $false
  }
}

if (Test-OllamaModel -ExpectedModel $Model) {
  Write-Host "Ollama is already serving $Model."
  exit 0
}

if (-not (Test-Path -LiteralPath $OllamaExe)) {
  throw "Ollama executable not found: $OllamaExe"
}

if (-not (Test-Path -LiteralPath $ModelDir)) {
  throw "Ollama model directory not found: $ModelDir"
}

Write-Host "Starting Ollama with models at $ModelDir"
Write-Host "Expected model: $Model"

Get-Process "ollama app" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force

$env:OLLAMA_MODELS = $ModelDir
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", $ModelDir, "User")

& $OllamaExe serve
