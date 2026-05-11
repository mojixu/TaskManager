@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\register-startup-task.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-windows-shortcuts.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-edge-pwa.ps1"
pause
