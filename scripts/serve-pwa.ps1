$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

$portInUse = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
  Write-Host 'Task Manager Panel server is already running at http://127.0.0.1:4173/'
  exit 0
}

if (-not (Test-Path 'dist\index.html')) {
  npm.cmd run build
}

npm.cmd run preview:local
