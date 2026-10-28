@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Open BUILD BOT.ps1"
if errorlevel 1 pause
