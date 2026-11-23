# Run once from an elevated PowerShell window while logged in as the account
# that owns Docker Desktop. Does not change or delete application data.
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$StartScript = Join-Path $PSScriptRoot 'Start-BCS.ps1'
$WatchdogScript = Join-Path $PSScriptRoot 'Watchdog-BCS.ps1'
$PowerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$User = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Highest

$startAction = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`"" -WorkingDirectory $ProjectRoot
$startTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'BCS - Start after Windows login' -Action $startAction -Trigger $startTrigger -Settings $settings -Description 'Starts BCS Docker services after Windows/Docker Desktop starts.' -Principal $Principal -Force | Out-Null

$watchAction = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`"" -WorkingDirectory $ProjectRoot
$watchTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName 'BCS - Self healing watchdog' -Action $watchAction -Trigger $watchTrigger -Settings $settings -Description 'Checks BCS containers every five minutes and recovers stopped/unhealthy services.' -Principal $Principal -Force | Out-Null
Write-Host 'BCS autostart and watchdog tasks installed.' -ForegroundColor Green
Write-Host 'IMPORTANT: Enable Docker Desktop -> Settings -> General -> Start Docker Desktop when you sign in.' -ForegroundColor Yellow
Write-Host 'Configure BIOS/UEFI: Restore on AC Power Loss = Power On (or Last State).' -ForegroundColor Yellow

$backupScript = Join-Path $PSScriptRoot 'Copy-BCS-Backups.ps1'
$backupAction = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`"" -WorkingDirectory $ProjectRoot
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '3:45AM'
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName 'BCS - Copy verified backups off-host' -Action $backupAction -Trigger $backupTrigger -Settings $backupSettings -Description 'Copies SHA-256 verified database backups to a separate disk or NAS.' -Principal $Principal -Force | Out-Null
