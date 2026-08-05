param(
  [string]$SiteUrl = "https://volvo-dsc-pc-test-2026.sosoobi.chatgpt.site",
  [string]$MedalliaUrl = "https://volvo.medallia.eu/sso/volvo/applications/ex_WEB-9/pages/255?roleId=50851&f.segment-ranker=k_global_region_combo_enum&f.benchmark=100000006&f.feedback-type=all-feedback&f.alert-status=6&f.question-score=a_overall_score_with_social_media_5_buckets&f.timeperiod=361&f.reporting-date=e_creationdate&fi.segment-ranker=k_global_region_combo_enum&fi.question-score=a_overall_score_with_social_media_5_buckets&fi.benchmark=100000006&fi.pfk_volvo_event_type_combo_enum=242_24&fi.alert-status=6&fi.reporting-date=e_creationdate&fi.timeperiod=361",
  [string]$ExtraHolidays = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:ONE_VOICE_INGEST_TOKEN)) {
  throw "Set ONE_VOICE_INGEST_TOKEN for this process before installing."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$runtimeRoot = "C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node"
$nodePath = Join-Path $runtimeRoot "bin\node.exe"
$playwrightRoot = Join-Path $runtimeRoot "node_modules\playwright-core"
if (-not (Test-Path -LiteralPath $nodePath)) { throw "Bundled Node.js was not found: $nodePath" }
if (-not (Test-Path -LiteralPath $playwrightRoot)) { throw "Bundled Playwright was not found: $playwrightRoot" }

$localRoot = Join-Path $env:LOCALAPPDATA "VolvoDashboard"
$profileDir = Join-Path $localRoot "one-voice-chrome-profile"
$configPath = Join-Path $localRoot "one-voice.json"
New-Item -ItemType Directory -Force -Path $localRoot, $profileDir | Out-Null

$safeUrl = [UriBuilder]$MedalliaUrl
$safeQuery = @(
  $safeUrl.Query.TrimStart("?").Split("&", [StringSplitOptions]::RemoveEmptyEntries) |
    Where-Object { $_ -notmatch "^alreftoken=" }
)
$safeUrl.Query = [string]::Join("&", $safeQuery)
$tokenCipher = ConvertTo-SecureString $env:ONE_VOICE_INGEST_TOKEN -AsPlainText -Force | ConvertFrom-SecureString
$config = [ordered]@{
  siteUrl = $SiteUrl.TrimEnd("/")
  medalliaUrl = $safeUrl.Uri.AbsoluteUri
  profileDir = $profileDir
  nodePath = $nodePath
  playwrightRoot = $playwrightRoot
  collectorPath = Join-Path $repoRoot "scripts\one-voice\collect.mjs"
  extraHolidays = $ExtraHolidays
  tokenCipher = $tokenCipher
}
$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

$taskName = "Volvo Dashboard - ONE VOICE Hourly Sync"
$runner = Join-Path $repoRoot "scripts\one-voice\run-collector.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 9:00AM
$trigger.Repetition = New-CimInstance -ClientOnly -Namespace "Root/Microsoft/Windows/TaskScheduler" -ClassName "MSFT_TaskRepetitionPattern" -Property @{
  Interval = "PT10M"
  Duration = "PT9H"
  StopAtDurationEnd = $false
}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 8)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Authenticated ONE VOICE score sync, 09:00-17:00 KST on Korean business days" -Force | Out-Null

Write-Host "Installed scheduled task: $taskName"
Write-Host "The task checks every 10 minutes and collects only when the current hourly slot is missing."
