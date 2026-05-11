$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

npm.cmd run lint
npm.cmd run test
npm.cmd run build
