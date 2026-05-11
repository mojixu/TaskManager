$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $projectRoot

$edgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$edgePath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw 'Microsoft Edge was not found. Install Edge first, then run this script again.'
}

if (-not (Test-Path 'dist\index.html')) {
  npm.cmd run build
}

$server = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if (-not $server) {
  $serverScript = Join-Path $projectRoot 'scripts\serve-pwa.ps1'
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    "`"$serverScript`""
  ) -WorkingDirectory $projectRoot -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

$url = 'http://127.0.0.1:4173/'
Start-Process -FilePath $edgePath -ArgumentList @("--install-app=$url") -WorkingDirectory $projectRoot
Start-Sleep -Seconds 2
Start-Process -FilePath $edgePath -ArgumentList @('--app=' + $url) -WorkingDirectory $projectRoot

Write-Host "Opened Edge PWA for $url" -ForegroundColor Green
