param(
  [string]$ExtraHolidays = ""
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $env:LOCALAPPDATA "VolvoDashboard\one-voice.json"
if (-not (Test-Path -LiteralPath $configPath)) {
  throw "ONE VOICE configuration was not found."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$secureToken = ConvertTo-SecureString $config.tokenCipher
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $sourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..\browser-extension\one-voice-existing-tab")).Path
  $targetDir = Join-Path $env:LOCALAPPDATA "VolvoDashboard\one-voice-existing-tab-extension"
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

  foreach ($name in @("manifest.json", "background.js", "content.js")) {
    Copy-Item -LiteralPath (Join-Path $sourceDir $name) -Destination (Join-Path $targetDir $name) -Force
  }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "korean-business-day.mjs") -Destination (Join-Path $targetDir "business-day.js") -Force

  $holidays = @(
    $ExtraHolidays.Split(",", [StringSplitOptions]::RemoveEmptyEntries) |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ -match "^\d{4}-\d{2}-\d{2}$" }
  )
  $localConfig = [ordered]@{
    siteUrl = $config.siteUrl
    ingestToken = $token
    extraHolidays = $holidays
  } | ConvertTo-Json -Compress
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText(
    (Join-Path $targetDir "local-config.js"),
    "export const ONE_VOICE_CONFIG = $localConfig;",
    $encoding
  )

  Disable-ScheduledTask -TaskName "Volvo Dashboard - ONE VOICE Hourly Sync" -ErrorAction SilentlyContinue | Out-Null
  Write-Output $targetDir
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
