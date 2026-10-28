@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Open BUILD BOT 2.0.ps1"
if errorlevel 1 pause
