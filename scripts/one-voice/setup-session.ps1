$ErrorActionPreference = "Stop"

$configPath = Join-Path $env:LOCALAPPDATA "VolvoDashboard\one-voice.json"
if (-not (Test-Path -LiteralPath $configPath)) {
  throw "ONE VOICE configuration was not found. Run install-task.ps1 first."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$secureToken = ConvertTo-SecureString $config.tokenCipher
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:ONE_VOICE_INGEST_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $env:ONE_VOICE_SITE_URL = $config.siteUrl
  $env:ONE_VOICE_MEDALLIA_URL = $config.medalliaUrl
  $env:ONE_VOICE_PROFILE_DIR = $config.profileDir
  $env:ONE_VOICE_PLAYWRIGHT_ROOT = $config.playwrightRoot
  $env:ONE_VOICE_EXTRA_HOLIDAYS = $config.extraHolidays
  Write-Host "ONE VOICE 로그인 창이 열립니다. 로그인과 2차 인증 후 Market - Admin 화면을 유지해 주세요."
  & $config.nodePath $config.collectorPath --setup
  if ($LASTEXITCODE -ne 0) { throw "ONE VOICE session setup failed." }
  Write-Host "로그인 세션 확인이 완료되었습니다. 이 창을 닫아도 됩니다."
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  Remove-Item Env:\ONE_VOICE_INGEST_TOKEN -ErrorAction SilentlyContinue
}
