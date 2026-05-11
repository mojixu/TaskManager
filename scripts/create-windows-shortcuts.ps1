$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverScript = Join-Path $projectRoot 'scripts\serve-pwa.ps1'
$pwaUrl = 'http://127.0.0.1:4173/'

$edgeCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

$edgePath = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edgePath) {
  throw 'Microsoft Edge was not found.'
}

$shell = New-Object -ComObject WScript.Shell
$startupFolder = $shell.SpecialFolders.Item('Startup')
$desktopFolder = $shell.SpecialFolders.Item('Desktop')
$programsFolder = $shell.SpecialFolders.Item('Programs')

$serverShortcut = $shell.CreateShortcut((Join-Path $startupFolder 'TaskManagerPanelServer.lnk'))
$serverShortcut.TargetPath = 'powershell.exe'
$serverShortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$serverScript`""
$serverShortcut.WorkingDirectory = $projectRoot
$serverShortcut.WindowStyle = 7
$serverShortcut.Description = 'Start local server for 墨迹任务面板 PWA.'
$serverShortcut.Save()

$desktopShortcutPath = Join-Path $desktopFolder 'Task Manager Panel.lnk'

Get-ChildItem -LiteralPath $desktopFolder -Filter '*.lnk' | ForEach-Object {
  $shortcut = $shell.CreateShortcut($_.FullName)
  if ($shortcut.Arguments -eq "--app=$pwaUrl" -and $_.FullName -ne $desktopShortcutPath) {
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

$appShortcut = $shell.CreateShortcut($desktopShortcutPath)
$appShortcut.TargetPath = $edgePath
$appShortcut.Arguments = "--app=$pwaUrl"
$appShortcut.WorkingDirectory = $projectRoot
$appShortcut.IconLocation = "$edgePath,0"
$appShortcut.Description = 'Open Task Manager Panel in Microsoft Edge app mode.'
$appShortcut.Save()

$startMenuShortcut = $shell.CreateShortcut((Join-Path $programsFolder 'Task Manager Panel.lnk'))
$startMenuShortcut.TargetPath = $edgePath
$startMenuShortcut.Arguments = "--app=$pwaUrl"
$startMenuShortcut.WorkingDirectory = $projectRoot
$startMenuShortcut.IconLocation = "$edgePath,0"
$startMenuShortcut.Description = 'Open Task Manager Panel in Microsoft Edge app mode.'
$startMenuShortcut.Save()

Write-Host "Created startup shortcut: $startupFolder\TaskManagerPanelServer.lnk" -ForegroundColor Green
Write-Host "Created desktop shortcut: $desktopShortcutPath" -ForegroundColor Green
Write-Host "Created Start Menu shortcut: $programsFolder\Task Manager Panel.lnk" -ForegroundColor Green
