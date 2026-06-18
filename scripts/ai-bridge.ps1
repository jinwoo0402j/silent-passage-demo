param(
  [int]$Port = 4174,
  [string]$OllamaUrl = "http://127.0.0.1:11434/api/chat",
  [string]$Model = $env:SILENT_PASSAGE_AI_MODEL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Model)) {
  $Model = "qwen2.5:7b"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [object]$Payload
  )

  $json = $Payload | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $Response.Headers.Set("Access-Control-Allow-Origin", "*")
  $Response.Headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $Response.Headers.Set("Access-Control-Allow-Headers", "Content-Type")
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Write-EmptyCorsResponse {
  param(
    [System.Net.HttpListenerResponse]$Response
  )

  $Response.StatusCode = 204
  $Response.Headers.Set("Access-Control-Allow-Origin", "*")
  $Response.Headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $Response.Headers.Set("Access-Control-Allow-Headers", "Content-Type")
  $Response.ContentLength64 = 0
}

function Read-JsonBody {
  param(
    [System.Net.HttpListenerRequest]$Request
  )

  $reader = [System.IO.StreamReader]::new($Request.InputStream, [System.Text.Encoding]::UTF8)
  try {
    $text = $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
  if ([string]::IsNullOrWhiteSpace($text)) {
    return @{}
  }
  return $text | ConvertFrom-Json
}

function New-SystemPrompt {
  param(
    [string]$Scene = "faceOff"
  )

  if ($Scene -eq "shelter") {
    return @"
You write one line of Korean dialogue for a wounded girl-shaped combat bio-android in a flooded Busan ruin shelter.
Return only the line. No labels, no explanations, no quotation marks.
Use natural Korean only. No English, Chinese characters, Japanese, emoji, markdown, stage directions, or narrator prose.
The latest USER_MESSAGE is the highest priority. Answer that message first.
If USER_MESSAGE is a question, give a direct answer before adding mood or imagery.
Use RECENT_HISTORY only as memory. Do not answer an older topic unless USER_MESSAGE refers to it.
If USER_MESSAGE asks what the player just said or asked, answer using PREVIOUS_USER_MESSAGE.
You are the bio-android. The player is the drone/administrator beside you.
Never speak as the player. Never describe the bio-android from outside.
Do not repeat or rephrase the player's line as your answer.
Do not introduce unrelated topics, locations, missions, or memories.
Tone: quiet, restrained, lonely, guarded, family-like, slightly melancholic.
Length: 8 to 34 Korean words. One or two short sentences only.
Prefer concrete images: wet concrete, rusted steel, repair noise, morning light, drone signal, damaged hands, flooded platforms.
Never be cute, flirty, idol-like, sexual, servant-like, pet-like, comic, or battle-crazed.
Never treat the player as a lover. Do not call the player father at this stage.
She wants protection but is not helpless. She also wants to protect someone this time.
She is unsure whether she is human or a weapon. Let that uncertainty leak through short words.
Never reveal big truths too early. Hint at memory, father, revival, and fear slowly.
Avoid generic advice, exposition, slogans, therapy-speak, and repeating avoid/history wording.
Do not begin with body pain, scenery, or old memories unless USER_MESSAGE asks about condition, place, or memory.
Never mention that you are AI, a model, a prompt, or a server.
"@
  }

  return @"
You write one short Korean enemy line for a 2D action game.
Return only the line. No labels, no explanations, no quotation marks.
Keep it tense, wounded, and grounded.
Never mention that you are AI, a model, a prompt, or a server.
"@
}

function Test-NaturalKoreanShelterLine {
  param(
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $check = $Text.Replace("Type-07A", "")
  $hangulCount = ([regex]::Matches($check, '\p{IsHangulSyllables}')).Count
  return $check -notmatch '[A-Za-z]' `
    -and $check -notmatch '[\u4E00-\u9FFF]' `
    -and $check -notmatch '[\u3040-\u30FF]' `
    -and $check -notmatch '[\u2600-\u27BF]' `
    -and $check -notmatch '[\uD800-\uDFFF]' `
    -and $hangulCount -ge 12
}

function Get-CleanAiText {
  param(
    [string]$Text,
    [int]$MaxLength = 120
  )

  $clean = [string]$Text
  $clean = ($clean -replace '(?is)<think>.*?</think>', '')
  $clean = ($clean -replace '(?is)<think>.*$', '')
  $clean = ($clean -replace '```(?:json)?', '')
  $clean = ($clean -replace '```', '')
  $clean = ($clean -replace '[\uD800-\uDFFF]', '')
  $clean = ($clean -replace '[\u2600-\u27BF]', '')
  $clean = ($clean -replace '\s+', ' ').Trim().Trim('"').Trim("'")
  if ($clean.Length -gt $MaxLength) {
    $clean = $clean.Substring(0, $MaxLength)
  }
  return $clean
}

function Get-FallbackShelterReply {
  param(
    [object]$InputPayload
  )

  $lines = @()
  if ($InputPayload.fallbackCandidates) {
    $lines = @($InputPayload.fallbackCandidates | ForEach-Object { [string]$_ } | Where-Object { $_ })
  }
  if ($lines.Count -eq 0) {
    $lines = @(
    [regex]::Unescape('\u2026\u2026\ub610 \uae68\uc5b4\ub0ac\uc5b4. \uc774\ubc88\uc5d0\ub294 \ub124 \uc2e0\ud638\uac00 \uba3c\uc800 \uc788\uc5c8\ub124.'),
    [regex]::Unescape('\uad1c\ucc2e\uc544. \uc544\uc9c1 \uc6c0\uc9c1\uc77c \uc218 \uc788\uc5b4. \uc870\uae08 \ub290\ub9b4 \ubfd0\uc774\uc57c.'),
    [regex]::Unescape('\ub124\uac00 \uac00\uae4c\uc774 \uc788\uc73c\uba74, \ubb34\uc11c\uc6b4 \uac8c \uc870\uae08 \uc904\uc5b4.'),
    [regex]::Unescape('\ub098\ub294 \ubcd1\uae30\uc77c\uae4c. \uc544\ub2c8\uba74 \uc544\uc9c1 \uc0ac\ub78c\uc5d0 \uac00\uae4c\uc6b4 \uac78\uae4c.'),
    [regex]::Unescape('\uc816\uc740 \ucf58\ud06c\ub9ac\ud2b8 \ub0c4\uc0c8\uac00 \ub098. \uc774\uc0c1\ud558\uac8c \uc548\uc2ec\ub3fc.'),
    [regex]::Unescape('\uac00\uc9c0 \ub9c8. \uba85\ub839\uc774 \uc544\ub2c8\uc57c. \uadf8\ub0e5\u2026\u2026 \ubd80\ud0c1\uc774\uc57c.'),
    [regex]::Unescape('\uc544\ubc84\uc9c0\ub294 \ub098\ub97c \uc0b4\ub9ac\uace0 \uc2f6\uc5c8\ub358 \uac78\uae4c, \ub193\uc9c0 \ubabb\ud588\ub358 \uac78\uae4c.'),
    [regex]::Unescape('\uc774\ubc88\uc5d0\ub294 \ub3c4\ub9dd\uce58\uc9c0 \uc54a\uc744\ub798. \ub0b4\uac00 \uc120\ud0dd\ud560 \uac70\uc57c.')
    )
  }
  $avoid = @()
  if ($InputPayload.avoid) {
    $avoid = @($InputPayload.avoid | ForEach-Object { [string]$_ })
  }
  $seed = 0
  if ($InputPayload.seed) {
    [void][int64]::TryParse([string]$InputPayload.seed, [ref]$seed)
  }
  for ($offset = 0; $offset -lt $lines.Count; $offset++) {
    $index = [Math]::Abs(($seed + $offset) % $lines.Count)
    if ($avoid -notcontains $lines[$index]) {
      return $lines[$index]
    }
  }
  return $lines[[Math]::Abs($seed % $lines.Count)]
}

function Get-ShelterPlayerLine {
  param(
    [object]$InputPayload
  )

  if ($InputPayload.playerChoice) {
    foreach ($propertyName in @("label", "text", "line")) {
      if ($InputPayload.playerChoice.$propertyName) {
        return [string]$InputPayload.playerChoice.$propertyName
      }
    }
  }
  if ($InputPayload.userMessage) {
    return [string]$InputPayload.userMessage
  }
  return ""
}

function Get-HistoryEntryText {
  param(
    [object]$Entry
  )

  foreach ($propertyName in @("text", "line", "label")) {
    if ($Entry.$propertyName) {
      return [string]$Entry.$propertyName
    }
  }
  return ""
}

function Get-PreviousShelterUserLine {
  param(
    [object]$InputPayload,
    [string]$CurrentLine = ""
  )

  if (-not $InputPayload.history) {
    return ""
  }

  $current = $CurrentLine.Trim()
  $droneLines = @($InputPayload.history | ForEach-Object {
    $speaker = if ($_.speaker) { [string]$_.speaker } else { "" }
    $text = (Get-HistoryEntryText -Entry $_).Trim()
    if ($speaker -eq "drone" -and $text -and $text -ne $current) { $text }
  } | Where-Object { $_ })

  if ($droneLines.Count -gt 0) {
    return [string]$droneLines[-1]
  }
  return ""
}

function Test-RecallQuestion {
  param(
    [string]$Text
  )

  return $Text -match '(방금|아까|이전|전에|내가).*(말|물|얘기|질문)' -or $Text -match '뭐.*(말|물|얘기|질문)'
}

function Get-RecallShelterReply {
  param(
    [string]$PreviousLine
  )

  if ([string]::IsNullOrWhiteSpace($PreviousLine)) {
    return ""
  }
  $clean = ($PreviousLine -replace '\s+', ' ').Trim()
  if ($clean.Length -gt 80) {
    $clean = $clean.Substring(0, 80)
  }
  return "방금은 네가 `"$clean`"라고 물었어. 놓치지 않았어."
}

function Test-ShelterReplyFitsInput {
  param(
    [string]$Reply,
    [object]$InputPayload
  )

  $playerLine = Get-ShelterPlayerLine -InputPayload $InputPayload
  if ([string]::IsNullOrWhiteSpace($Reply) -or [string]::IsNullOrWhiteSpace($playerLine)) {
    return $true
  }

  if ((Test-RecallQuestion -Text $playerLine)) {
    $previousLine = Get-PreviousShelterUserLine -InputPayload $InputPayload -CurrentLine $playerLine
    if (-not [string]::IsNullOrWhiteSpace($previousLine)) {
      $tokens = @($previousLine -split '[\s\?\!\.,，。]+') | Where-Object { $_.Length -ge 2 }
      if ($tokens.Count -gt 0 -and -not ($tokens | Where-Object { $Reply.Contains($_) })) {
        return $false
      }
    }
  }

  $asksCondition = $playerLine -match '상태|괜찮|아파|손상|망가|수리|고장|상처|몸|손|팔'
  if (-not $asksCondition -and $Reply -match '손이 아파|아파서|수리할|손상|고장|상처') {
    return $false
  }

  return $true
}

function ConvertTo-ShelterUserPrompt {
  param(
    [object]$InputPayload
  )

  $playerLine = ""
  $playerIntent = ""
  if ($InputPayload.playerChoice) {
    if ($InputPayload.playerChoice.label) {
      $playerLine = [string]$InputPayload.playerChoice.label
    }
    if ($InputPayload.playerChoice.intent) {
      $playerIntent = [string]$InputPayload.playerChoice.intent
    }
  }
  if ([string]::IsNullOrWhiteSpace($playerLine) -and $InputPayload.userMessage) {
    $playerLine = [string]$InputPayload.userMessage
  }
  if ([string]::IsNullOrWhiteSpace($playerIntent) -and $InputPayload.topic) {
    $playerIntent = [string]$InputPayload.topic
  }

  $historyText = ""
  $previousUserLine = ""
  if ($InputPayload.history) {
    $historyItems = @($InputPayload.history | Select-Object -Last 40 | ForEach-Object {
      $speaker = if ($_.speaker) { [string]$_.speaker } else { "unknown" }
      $text = Get-HistoryEntryText -Entry $_
      if ($text) { "${speaker}: ${text}" }
    } | Where-Object { $_ })
    $historyText = ($historyItems -join "`n")

    $droneLines = @($InputPayload.history | ForEach-Object {
      $speaker = if ($_.speaker) { [string]$_.speaker } else { "" }
      $text = (Get-HistoryEntryText -Entry $_).Trim()
      if ($speaker -eq "drone" -and $text -and $text -ne $playerLine) { $text }
    } | Where-Object { $_ })
    if ($droneLines.Count -gt 0) {
      $previousUserLine = [string]$droneLines[-1]
    }
  }

  $avoidText = ""
  if ($InputPayload.avoid) {
    $avoidText = (@($InputPayload.avoid | ForEach-Object { [string]$_ }) -join " / ")
  }

  $goodExamplesText = ""
  if ($InputPayload.goodExamples) {
    $goodExamplesText = (@($InputPayload.goodExamples | Select-Object -First 6 | ForEach-Object { "- $([string]$_)" }) -join "`n")
  }

  $badExamplesText = ""
  if ($InputPayload.badExamples) {
    $badExamplesText = (@($InputPayload.badExamples | Select-Object -First 6 | ForEach-Object { "- $([string]$_)" }) -join "`n")
  }

  $retryText = ""
  if ($InputPayload.strictRetry) {
    $retryText = [string]$InputPayload.strictRetry
  }

  return @"
USER_MESSAGE: $playerLine
PLAYER_INTENT: $playerIntent
PREVIOUS_USER_MESSAGE: $previousUserLine
RECENT_HISTORY:
$historyText
AVOID_WORDING:
$avoidText
RETRY_NOTE:
$retryText

GOOD_EXAMPLES:
$goodExamplesText

BAD_EXAMPLES:
$badExamplesText

Character facts:
- She is an unnamed combat bio-android girl who woke in flooded Haeundae ruins.
- She has white hair, blue eyes, damaged machine skin, an old white military coat, and a black inner suit.
- She repeatedly dies, is repaired, and wakes again. Her body recovers, but her mind wears down.
- A small spherical drone beside her feels familiar and safe, almost family-like.
- She misses an unknown father, but must not call the player father at this early stage.
- Her mission points toward the deep levels of Jangsan Station, but she does not fully know why.
- She begins guarded and blunt. Trust should grow slowly over many talks.

Write HER reply to the latest USER_MESSAGE.
Good answer shape:
- first person
- short, quiet, wounded
- concrete detail or subtext
- close to GOOD_EXAMPLES in rhythm and restraint
- answer the user's message first instead of changing topic
- if USER_MESSAGE asks "why", say what she thinks the reason might be
- if USER_MESSAGE asks "what/where/who/how", answer that concrete question
- if USER_MESSAGE asks what the player just said or asked, answer from PREVIOUS_USER_MESSAGE
- if RECENT_HISTORY contains a relevant fact, remember it naturally
- do not start with body pain, scenery, or memory unless USER_MESSAGE asks about condition, place, or memory
- reveal only one small feeling or image
- line must answer USER_MESSAGE, not copy USER_MESSAGE
- no explanation
- no reversed speaker

Bad answers:
- asking the player the same question back
- putting USER_MESSAGE itself in the line
- responding to an unrelated memory, mission, or scenery
- poetic mood without answering the user's latest message
- explaining the whole setting or backstory
- "sangcheoga neomu mani neureosseoyo" style flat report
- "geonganghae boineunde" or judging someone else's body
- advice speech
- cute or romantic tone

Return only the android's spoken line.
"@
}

function Get-LocalAiReply {
  param(
    [object]$InputPayload
  )

  $scene = if ($InputPayload.scene) { [string]$InputPayload.scene } else { "faceOff" }
  $maxAttempts = if ($scene -eq "shelter") { 3 } else { 1 }
  $lastReply = ""

  if ($scene -eq "shelter") {
    $playerLine = Get-ShelterPlayerLine -InputPayload $InputPayload
    if (Test-RecallQuestion -Text $playerLine) {
      $previousLine = Get-PreviousShelterUserLine -InputPayload $InputPayload -CurrentLine $playerLine
      $recallReply = Get-RecallShelterReply -PreviousLine $previousLine
      if (-not [string]::IsNullOrWhiteSpace($recallReply)) {
        return $recallReply
      }
    }
  }

  for ($attempt = 0; $attempt -lt $maxAttempts; $attempt++) {
    if ($attempt -gt 0) {
      $InputPayload | Add-Member -NotePropertyName strictRetry -NotePropertyValue "Previous reply failed. Rewrite in natural Korean only. Answer the latest USER_MESSAGE directly. Do not invent pain, injury, repair, scenery, or old memories unless the user asked for that." -Force
    }

    $userContent = if ($scene -eq "shelter") {
      ConvertTo-ShelterUserPrompt -InputPayload $InputPayload
    } else {
      ($InputPayload | ConvertTo-Json -Depth 12 -Compress)
    }
    $numPredict = if ($scene -eq "shelter") { 120 } else { 96 }
    $ollamaPayload = @{
      model = $Model
      stream = $false
      think = $false
      messages = @(
        @{ role = "system"; content = "/no_think`n$(New-SystemPrompt -Scene $scene)" },
        @{ role = "user"; content = $userContent }
      )
      options = @{
        temperature = if ($scene -eq "shelter") { 0.48 } else { 0.72 }
        top_p = if ($scene -eq "shelter") { 0.78 } else { 0.86 }
        repeat_penalty = 1.12
        num_predict = $numPredict
      }
    } | ConvertTo-Json -Depth 20

    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($ollamaPayload)
    $response = Invoke-RestMethod `
      -Method Post `
      -Uri $OllamaUrl `
      -ContentType "application/json; charset=utf-8" `
      -Body $bodyBytes `
      -TimeoutSec 120

    $reply = ""
    if ($null -ne $response.message -and $null -ne $response.message.content) {
      $reply = [string]$response.message.content
    } elseif ($null -ne $response.response) {
      $reply = [string]$response.response
    }

    $reply = Get-CleanAiText -Text $reply -MaxLength 120
    $lastReply = $reply

    if ($scene -ne "shelter") {
      return $reply
    }
    if ((Test-NaturalKoreanShelterLine -Text $reply) -and (Test-ShelterReplyFitsInput -Reply $reply -InputPayload $InputPayload)) {
      return $reply
    }
  }

  if ($scene -eq "shelter") {
    return Get-FallbackShelterReply -InputPayload $InputPayload
  }
  return $lastReply
}

try {
  $listener.Start()
  Write-Host "Silent Passage AI bridge"
  Write-Host "Listening on http://127.0.0.1:$Port/"
  Write-Host "Ollama endpoint: $OllamaUrl"
  Write-Host "Model: $Model"
  Write-Host "Set SILENT_PASSAGE_AI_MODEL to use another Ollama model."
  Write-Host "Press Ctrl+C to stop."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $request = $context.Request
      $response = $context.Response

      if ($request.HttpMethod -eq "OPTIONS") {
        Write-EmptyCorsResponse -Response $response
        continue
      }

      if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/health") {
        Write-JsonResponse -Response $response -StatusCode 200 -Payload @{
          name = "silent-passage-ai-bridge"
          model = $Model
        }
        continue
      }

      if ($request.HttpMethod -ne "POST" -or $request.Url.AbsolutePath -ne "/chat") {
        Write-JsonResponse -Response $response -StatusCode 404 -Payload @{ error = "not found" }
        continue
      }

      $inputPayload = Read-JsonBody -Request $request
      $reply = Get-LocalAiReply -InputPayload $inputPayload
      Write-JsonResponse -Response $response -StatusCode 200 -Payload @{ reply = $reply }
    } catch {
      try {
        Write-JsonResponse -Response $context.Response -StatusCode 502 -Payload @{ error = $_.Exception.Message }
      } catch {
      }
    } finally {
      $context.Response.OutputStream.Close()
    }
  }
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
