$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectRoot 'ops\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir 'watchdog.log'
function Write-Log($Message) { Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" }
Set-Location $ProjectRoot

try { docker info *> $null } catch { Write-Log 'Docker CLI unavailable.'; exit 1 }
if ($LASTEXITCODE -ne 0) { Write-Log 'Docker engine unavailable; startup task will retry.'; exit 1 }

# Compose reconciles stopped/missing core containers without rebuilding images.
docker compose up -d *> $null
if ($LASTEXITCODE -ne 0) { Write-Log 'WARNING: compose reconciliation failed.'; exit 2 }

$containers = @('vks-backend','vks-nginx','vks-queue','vks-scheduler','vks-redis')
foreach ($name in $containers) {
    $exists = docker inspect $name 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Log "Container missing after compose up: $name"; continue }
    $state = docker inspect --format '{{.State.Status}}' $name 2>$null
    $health = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $name 2>$null
    if ($state -ne 'running') {
        Write-Log "Container $name state=$state; compose will recreate it."
        docker compose up -d $name *> $null
    } elseif ($health -eq 'unhealthy') {
        Write-Log "Container $name is unhealthy; restarting container."
        docker restart $name *> $null
    }
}

# Never blindly restart MySQL because an unhealthy probe can be caused by a
# slow recovery or disk pressure. Report it and preserve database integrity.
$dbState = docker inspect --format '{{.State.Status}}' vks-mysql 2>$null
$dbHealth = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' vks-mysql 2>$null
if ($dbState -ne 'running' -or $dbHealth -eq 'unhealthy') {
    Write-Log "CRITICAL: MySQL state=$dbState health=$dbHealth. No forced restart performed. Check disk and MySQL logs."
}

# Optional bot: recreate/start it when explicitly enabled in .env. Do not
# enable it by default, and never rebuild the image from the watchdog.
$envFile = Join-Path $ProjectRoot '.env'
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile
    $botExpected = ($envLines | Where-Object { $_ -match '^VKSBOT_EXPECTED\s*=\s*true\s*$' } | Select-Object -First 1)
    $botToken = ($envLines | Where-Object { $_ -match '^BOT_TOKENS\s*=\s*\S+' } | Select-Object -First 1)
    if ($botExpected -and $botToken) {
        docker compose --profile bot up -d vks-bot *> $null
        if ($LASTEXITCODE -ne 0) { Write-Log 'WARNING: optional bot could not be reconciled.' }
    }
}
$botExists = docker inspect vks-bot 2>$null
if ($LASTEXITCODE -eq 0) {
    $botState = docker inspect --format '{{.State.Status}}' vks-bot 2>$null
    $botHealth = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' vks-bot 2>$null
    if ($botState -ne 'running') { Write-Log "VKS bot state=$botState; starting."; docker start vks-bot *> $null } elseif ($botHealth -eq 'unhealthy') { Write-Log 'VKS bot unhealthy; restarting.'; docker restart vks-bot *> $null }
}
Write-Log 'Watchdog check completed.'
exit 0
