$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

Write-Host 'Starting 墨迹任务面板 at http://127.0.0.1:5173/' -ForegroundColor Green
npm.cmd run dev:local
