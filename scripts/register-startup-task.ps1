$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$scriptPath = Join-Path $projectRoot 'scripts\serve-pwa.ps1'
$taskName = 'TaskManagerPanelLocalServer'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

try {
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Start local production server for 墨迹任务面板 PWA.' -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Write-Host "Registered and started scheduled task: $taskName" -ForegroundColor Green
} catch {
  Write-Host 'Scheduled task registration failed. Falling back to Startup folder shortcut.' -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot 'create-windows-shortcuts.ps1')
}
