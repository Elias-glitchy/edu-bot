param([switch]$NoOpen)

$launcher = Join-Path $PSScriptRoot 'Open BUILD BOT.ps1'
& $launcher -NoOpen:$NoOpen
exit $LASTEXITCODE
