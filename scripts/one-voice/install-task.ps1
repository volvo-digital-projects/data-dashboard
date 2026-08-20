param(
  [string]$SiteUrl = "https://volvo-dsc-pc-test-2026.kongboojang.chatgpt.site",
  [string]$ExtraHolidays = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:ONE_VOICE_INGEST_TOKEN)) {
  throw "Set ONE_VOICE_INGEST_TOKEN for this process before preparing the extension."
}

$localRoot = Join-Path $env:LOCALAPPDATA "VolvoDashboard"
$configPath = Join-Path $localRoot "one-voice.json"
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null

$tokenCipher = ConvertTo-SecureString $env:ONE_VOICE_INGEST_TOKEN -AsPlainText -Force | ConvertFrom-SecureString
$config = [ordered]@{
  siteUrl = $SiteUrl.TrimEnd("/")
  extraHolidays = $ExtraHolidays
  tokenCipher = $tokenCipher
}
$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

Disable-ScheduledTask -TaskName "Volvo Dashboard - ONE VOICE Hourly Sync" -ErrorAction SilentlyContinue | Out-Null
& (Join-Path $PSScriptRoot "prepare-existing-tab-extension.ps1") -ExtraHolidays $ExtraHolidays

Write-Host "Prepared the existing-tab Chrome extension."
Write-Host "The retired dedicated-profile scheduled task remains disabled."
