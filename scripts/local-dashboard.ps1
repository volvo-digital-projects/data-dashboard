param([ValidateSet('Watch','Start','Open','Status','Stop')][string]$Mode = 'Open')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StateRoot = Join-Path $ProjectRoot 'work\local-server'
$TaskName = 'Volvo-Data-Dashboard-Local'
$Url = 'http://localhost:4187/'
New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
$ControlPath = Join-Path $StateRoot 'control.json'
$StatusPath = Join-Path $StateRoot 'status.json'
$LogPath = Join-Path $StateRoot 'supervisor.log'
function Write-Event($Message) {
    Add-Content -LiteralPath $LogPath -Encoding UTF8 -Value ((Get-Date -Format o) + ' ' + $Message)
}
function Test-Ready {
    try { return (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200 }
    catch { return $false }
}
function Resolve-Node {
    $portable = Join-Path $StateRoot 'node.exe'
    if (Test-Path -LiteralPath $portable) { return $portable }
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command -and (Test-Path -LiteralPath $command.Source)) { return $command.Source }
    $candidates = Get-ChildItem 'C:\Program Files\WindowsApps' -Directory -Filter 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    foreach ($candidate in $candidates) {
        $executable = Join-Path $candidate.FullName 'dependencies\node\bin\node.exe'
        if (Test-Path -LiteralPath $executable) { return $executable }
    }
    throw 'Node is unavailable. Install Node or repair the Codex runtime.'
}
if ($Mode -eq 'Status') {
    [pscustomobject]@{Project=$ProjectRoot; Ready=(Test-Ready); Url=$Url; Log=$LogPath} | ConvertTo-Json
    if (Test-Path -LiteralPath $StatusPath) { Get-Content -LiteralPath $StatusPath }
    exit
}
if ($Mode -eq 'Stop') {
    @{running=$false} | ConvertTo-Json | Set-Content -LiteralPath $ControlPath -Encoding UTF8
    Write-Output 'Local supervisor stop requested.'
    exit
}
if ($Mode -ne 'Watch') {
    @{running=$true} | ConvertTo-Json | Set-Content -LiteralPath $ControlPath -Encoding UTF8
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) { Start-ScheduledTask -TaskName $TaskName }
    else {
        $shell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSCommandPath + '" -Mode Watch'
        $startup = ([wmiclass]'Win32_ProcessStartup').CreateInstance()
        $startup.ShowWindow = 0
        $result = ([wmiclass]'Win32_Process').Create('"' + $shell + '" ' + $arguments, $ProjectRoot, $startup)
        if ($result.ReturnValue -ne 0) { throw 'Unable to launch independent local supervisor.' }
    }
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        if (Test-Ready) {
            if ($Mode -eq 'Open') { Start-Process $Url }
            Write-Output ('Dashboard ready: ' + $Url)
            exit
        }
        Start-Sleep -Seconds 2
    }
    throw ('Local startup timed out. See ' + $LogPath)
}
$mutex = New-Object System.Threading.Mutex($false, 'Local\VolvoDataDashboard4187')
$acquired = $false
$child = $null
try {
    try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired=$true }
    if (-not $acquired) { exit }
    if (-not (Test-Path -LiteralPath $ControlPath)) {
        @{running=$true} | ConvertTo-Json | Set-Content -LiteralPath $ControlPath -Encoding UTF8
    }
    Write-Event ('Supervisor started, PID ' + $PID)
    while ((Get-Content -LiteralPath $ControlPath -Raw | ConvertFrom-Json).running) {
        $ready = Test-Ready
        $listener = Get-NetTCPConnection -LocalPort 4187 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($child -and $child.HasExited) { Write-Event ('Server exited: ' + $child.ExitCode); $child=$null }
        if (-not $listener -and -not $child) {
            try {
                $nodePath = Resolve-Node
                $cli = Join-Path $ProjectRoot 'node_modules\vinext\dist\cli.js'
                if (-not (Test-Path -LiteralPath $cli)) { throw 'Run pnpm install --frozen-lockfile first.' }
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $child = Start-Process -FilePath $nodePath -ArgumentList @(('"'+$cli+'"'),'dev','--port','4187') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $StateRoot ($stamp+'.out.log')) -RedirectStandardError (Join-Path $StateRoot ($stamp+'.err.log')) -PassThru
                Write-Event ('Started local server, PID ' + $child.Id)
            } catch { Write-Event ('Start failed: ' + $_.Exception.Message) }
        }
        @{supervisorPid=$PID; serverPid=$(if($child){$child.Id}elseif($listener){$listener.OwningProcess}else{$null}); ready=$ready; checkedAt=(Get-Date -Format o); url=$Url} | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8
        Start-Sleep -Seconds 5
    }
} finally {
    if ($child -and -not $child.HasExited) { $child.Kill(); Write-Event 'Stopped owned local server.' }
    if ($acquired) { Write-Event 'Supervisor stopped.'; $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
