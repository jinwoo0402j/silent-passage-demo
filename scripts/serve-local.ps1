param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path $Root).Path
$address = [System.Net.IPAddress]::Parse("127.0.0.1")
$listener = [System.Net.Sockets.TcpListener]::new($address, $Port)

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".htm" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".mjs" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".md" = "text/markdown; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
  ".bat" = "text/plain; charset=utf-8"
}

function Send-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  if ($null -eq $Body) {
    $Body = [byte[]]::new(0)
  }

  $headers = @(
    "HTTP/1.1 $StatusCode $Reason",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Cache-Control: no-cache",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Send-TextResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [string]$Text
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Send-HttpResponse -Stream $Stream -StatusCode $StatusCode -Reason $Reason -Body $bytes
}

try {
  $listener.Start()
  Write-Host "Serving $Root"
  Write-Host "Open http://localhost:$Port/"
  Write-Host "Keep this window open while editing levels."
  Write-Host "Press Ctrl+C to stop."

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line.Length -eq 0) {
          break
        }
      }

      $parts = $requestLine -split " "
      if ($parts.Length -lt 2) {
        Send-TextResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -Text "Bad request"
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      if ($method -ne "GET" -and $method -ne "HEAD") {
        Send-TextResponse -Stream $stream -StatusCode 405 -Reason "Method Not Allowed" -Text "Method not allowed"
        continue
      }

      $urlPath = ($parts[1] -split "\?")[0]
      $decodedPath = [System.Uri]::UnescapeDataString($urlPath)
      if ([string]::IsNullOrWhiteSpace($decodedPath) -or $decodedPath -eq "/") {
        $decodedPath = "/index.html"
      }

      $relativePath = $decodedPath.TrimStart("/", "\") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $relativePath))
      if (-not $fullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-TextResponse -Stream $stream -StatusCode 403 -Reason "Forbidden" -Text "Forbidden"
        continue
      }

      if ([System.IO.Directory]::Exists($fullPath)) {
        $fullPath = [System.IO.Path]::Combine($fullPath, "index.html")
      }

      if (-not [System.IO.File]::Exists($fullPath)) {
        Send-TextResponse -Stream $stream -StatusCode 404 -Reason "Not Found" -Text "Not found"
        continue
      }

      $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($contentTypes.ContainsKey($ext)) { $contentTypes[$ext] } else { "application/octet-stream" }
      $body = if ($method -eq "HEAD") { [byte[]]::new(0) } else { [System.IO.File]::ReadAllBytes($fullPath) }
      Send-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body $body -ContentType $contentType
    } catch {
      try {
        Send-TextResponse -Stream $stream -StatusCode 500 -Reason "Internal Server Error" -Text $_.Exception.Message
      } catch {
      }
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}

