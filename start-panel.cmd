@echo off
cd /d "%~dp0"
echo Starting Task Manager Panel at http://127.0.0.1:5173/
npm.cmd run dev:local
pause
