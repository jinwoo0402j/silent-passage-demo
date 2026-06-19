param(
  [string]$VoiceDir = "assets/voice/shelter"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$voiceRoot = Join-Path $root $VoiceDir
$linesPath = Join-Path $voiceRoot "voice-lines.json"
$configPath = Join-Path $voiceRoot "sbv2.config.json"
$manifestPath = Join-Path $voiceRoot "manifest.json"

if (!(Test-Path $linesPath)) {
  throw "Missing voice line list: $linesPath"
}

$source = Get-Content -LiteralPath $linesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$config = $null
if (Test-Path $configPath) {
  $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
function Get-JsonStringOrDefault($Object, [string]$Name, [string]$DefaultValue) {
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property -and $null -ne $property.Value -and [string]$property.Value -ne "") {
    return [string]$property.Value
  }
  return $DefaultValue
}

function Get-JsonNumberOrDefault($Object, [string]$Name, [double]$DefaultValue) {
  if ($null -eq $Object) {
    return $DefaultValue
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property -and $null -ne $property.Value) {
    return [double]$property.Value
  }
  return $DefaultValue
}

function Get-JsonBoolOrDefault($Object, [string]$Name, [bool]$DefaultValue) {
  if ($null -eq $Object) {
    return $DefaultValue
  }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property -and $null -ne $property.Value) {
    return [bool]$property.Value
  }
  return $DefaultValue
}

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
  scene = Get-JsonStringOrDefault $source "scene" "shelter"
  speaker = Get-JsonStringOrDefault $source "speaker" "type-07a"
  voice = Get-JsonStringOrDefault $source "voice" "type07a"
  format = Get-JsonStringOrDefault $source "format" ""
  generator = Get-JsonStringOrDefault $source "generator" ""
  generatedAt = (Get-Date).ToString("s")
  playbackRate = Get-JsonNumberOrDefault $config.runtimePlayback "playbackRate" 1
  preservesPitch = Get-JsonBoolOrDefault $config.runtimePlayback "preservesPitch" $true
  lines = $lines
}

$manifestJson = $manifest | ConvertTo-Json -Depth 20
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $manifestJson + [Environment]::NewLine, $utf8NoBom)
Write-Host "Wrote $manifestPath with $($lines.Count) available voice lines."
