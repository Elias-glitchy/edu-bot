$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $projectRoot '.local-server\logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
Set-Location -LiteralPath $projectRoot

while ($true) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath (Join-Path $logRoot 'watchdog.log') -Value "$timestamp Starting EDU BOT on http://localhost:3005"
    try {
        & node --env-file-if-exists=.env.local apps/api/server.mjs *>> (Join-Path $logRoot 'server.log')
    }
    catch {
        Add-Content -LiteralPath (Join-Path $logRoot 'watchdog.log') -Value "$timestamp Server error: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 3
}
