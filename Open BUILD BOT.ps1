param([switch]$NoOpen)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:3005'
$logDirectory = Join-Path $projectDirectory '.local-server'
$env:COLLEAGUE_ZERO_PORT = '3005'
$env:COLLEAGUE_ZERO_DB = 'data/build-bot-colleague-zero.sqlite'

function Test-BuildBotServer {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200 -and $response.Content -match '<title>BUILD BOT 2.0</title>'
  } catch {
    return $false
  }
}

if (-not (Test-BuildBotServer)) {
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  # Use the stable server process for normal launches. The development watcher is
  # useful while editing, but it can exit after a terminal or Codex session ends.
  Start-Process -FilePath $npm -ArgumentList @('run', 'start') -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'build-bot.log') -RedirectStandardError (Join-Path $logDirectory 'build-bot-error.log') | Out-Null
  for ($attempt = 0; $attempt -lt 120 -and -not (Test-BuildBotServer); $attempt++) {
    Start-Sleep -Milliseconds 500
  }
}

if (-not (Test-BuildBotServer)) {
    throw "BUILD BOT 2.0 did not start at $url. Check .local-server\build-bot-error.log."
}

if (-not $NoOpen) { Start-Process $url }
