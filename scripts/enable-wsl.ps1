$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from PowerShell as Administrator.'
}

Write-Host 'Enabling Windows Subsystem for Linux 2 for BUILD BOT...' -ForegroundColor Cyan
wsl.exe --install --no-distribution
if ($LASTEXITCODE -ne 0) { throw "wsl --install failed with exit code $LASTEXITCODE" }

wsl.exe --update
if ($LASTEXITCODE -ne 0) { throw "wsl --update failed with exit code $LASTEXITCODE" }

wsl.exe --set-default-version 2
if ($LASTEXITCODE -ne 0) { throw "Setting WSL 2 as the default failed with exit code $LASTEXITCODE" }

Write-Host 'WSL 2 is enabled. Restart Windows if requested, then open Docker Desktop.' -ForegroundColor Green
Read-Host 'Press Enter to close'
