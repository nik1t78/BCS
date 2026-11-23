[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost',
    [switch]$IncludeBot
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$report = Join-Path $root "BCS-QA-$stamp.txt"
function Write-Result([string]$Name, [bool]$Ok, [string]$Details) {
    $status = if ($Ok) { 'PASS' } else { 'FAIL' }
    $line = "[$status] $Name :: $Details"
    Write-Host $line -ForegroundColor $(if ($Ok) { 'Green' } else { 'Yellow' })
    Add-Content -Path $report -Value $line -Encoding UTF8
}
"BCS release diagnostics $(Get-Date -Format o)" | Set-Content $report -Encoding UTF8
Write-Host "BCS diagnostics. Root: $root" -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Result 'Docker CLI' $false 'Docker не найден. Установите Docker Desktop и повторите.'
    Write-Host "Отчёт: $report"; exit 2
}
$dockerInfo = docker info 2>&1
Write-Result 'Docker Engine' ($LASTEXITCODE -eq 0) (($dockerInfo | Select-Object -Last 2) -join ' ')
if ($LASTEXITCODE -ne 0) { Write-Host "Отчёт: $report"; exit 2 }
$compose = docker compose config 2>&1
Write-Result 'Compose config' ($LASTEXITCODE -eq 0) (($compose | Select-Object -Last 3) -join ' ')
if ($LASTEXITCODE -ne 0) { Write-Host "Проверьте .env и отчёт: $report"; exit 2 }
$ps = docker compose ps --format json 2>&1
Write-Result 'Compose services' ($LASTEXITCODE -eq 0) 'Список контейнеров записан ниже в отчёт'
Add-Content $report ($ps -join "`n")
$mysql = docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 2>&1
Write-Result 'MySQL' ($LASTEXITCODE -eq 0) (($mysql -join ' ').Trim())
$redis = docker compose exec -T redis sh -lc 'redis-cli ping' 2>&1
Write-Result 'Redis' (($LASTEXITCODE -eq 0) -and (($redis -join '') -match 'PONG')) (($redis -join ' ').Trim())
$artisan = docker compose exec -T backend php artisan migrate:status --no-ansi 2>&1
Write-Result 'Laravel migrations' ($LASTEXITCODE -eq 0) (($artisan | Select-Object -Last 2) -join ' ')
Add-Content $report ($artisan -join "`n")
try {
    $home = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec 10 -UseBasicParsing
    Write-Result 'HTTP homepage' ($home.StatusCode -eq 200) "HTTP $($home.StatusCode)"
} catch { Write-Result 'HTTP homepage' $false $_.Exception.Message }
try {
    $api = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/api/health" -TimeoutSec 10 -UseBasicParsing
    Write-Result 'API health' ($api.StatusCode -eq 200) "HTTP $($api.StatusCode)"
} catch { Write-Result 'API health' $false $_.Exception.Message }
$envText = if (Test-Path '.env') { Get-Content '.env' -Raw } else { '' }
$hasBotToken = $envText -match '(?m)^BOT_TOKENS=.+$'
$hasMaxToken = $envText -match '(?m)^MAX_BOT_TOKEN=.+$'
Write-Result 'SaluteJazz token configured' $hasBotToken 'Значение секрета не выводится'
Write-Result 'MAX token configured' $hasMaxToken 'Значение секрета не выводится'
if ($IncludeBot) {
    docker compose --profile bot up -d vks-bot
    $bot = docker compose exec -T vks-bot python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8090/health',timeout=5).read().decode())" 2>&1
    Write-Result 'VKS bot health' ($LASTEXITCODE -eq 0) (($bot -join ' ').Trim())
} else {
    Add-Content $report '[SKIP] VKS bot health :: запустите скрипт с -IncludeBot для включения профиля bot'
}
Write-Host "`nПроверка завершена. Отчёт: $report" -ForegroundColor Cyan
Write-Host 'Скрипт не меняет и не удаляет базу данных или Docker volumes.'
