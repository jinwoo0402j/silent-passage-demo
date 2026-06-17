param(
  [string]$VoiceDir = "assets/voice/shelter"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$voiceRoot = Join-Path $root $VoiceDir
$linesPath = Join-Path $voiceRoot "voice-lines.json"
$manifestPath = Join-Path $voiceRoot "manifest.json"

if (!(Test-Path $linesPath)) {
  throw "Missing voice line list: $linesPath"
}

$source = Get-Content -LiteralPath $linesPath -Raw | ConvertFrom-Json
$lines = @()
foreach ($line in @($source.lines)) {
  if (!$line.file) {
    continue
  }
  $audioPath = Join-Path $voiceRoot ([string]$line.file)
  if (!(Test-Path $audioPath)) {
    continue
  }
  $lines += [ordered]@{
    id = [string]$line.id
    emotion = [string]$line.emotion
    topic = [string]$line.topic
    text = [string]$line.text
    src = "./assets/voice/shelter/$($line.file -replace '\\','/')"
    tags = @([string]$line.emotion, [string]$line.topic) | Where-Object { $_ }
  }
}

$manifest = [ordered]@{
  version = 1
  description = "Pre-generated shelter voice bank. Generated from voice-lines.json."
  generatedAt = (Get-Date).ToString("s")
  lines = $lines
}

$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Wrote $manifestPath with $($lines.Count) available voice lines."
