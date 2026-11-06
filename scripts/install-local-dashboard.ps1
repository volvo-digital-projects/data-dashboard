$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$state = Join-Path $root 'work\local-server'
New-Item -ItemType Directory -Force -Path $state | Out-Null
$nodeCommand = Get-Command node.exe -ErrorAction Stop
$target = Join-Path $state 'node.exe'
if ($nodeCommand.Source -ne $target) {
    Copy-Item -LiteralPath $nodeCommand.Source -Destination $target
    if ((Get-FileHash -LiteralPath $nodeCommand.Source).Hash -ne (Get-FileHash -LiteralPath $target).Hash) { throw 'Node runtime copy mismatch.' }
}
$shell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$script = Join-Path $PSScriptRoot 'local-dashboard.ps1'
$arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '" -Mode Watch'
$user = $env:USERDOMAIN + '\' + $env:USERNAME
$action = New-ScheduledTaskAction -Execute $shell -Argument $arguments -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$settings.Priority = 4
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Volvo-Data-Dashboard-Local' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Local D-drive dashboard only; no deployment or remote data jobs.' -Force | Out-Null
& $shell -NoProfile -ExecutionPolicy Bypass -File $script -Mode Start
