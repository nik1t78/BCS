$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectRoot 'ops\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir 'startup.log'
function Write-Log($Message) { Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" }
Set-Location $ProjectRoot
Write-Log 'Startup recovery started.'

# Docker Desktop runs under the logged-in Windows account. Its own auto-start
# setting must be enabled; this script waits for the engine instead of racing it.
$deadline = (Get-Date).AddMinutes(5)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try { docker info *> $null; if ($LASTEXITCODE -eq 0) { $ready = $true; break } } catch {}
    Start-Sleep -Seconds 10
}
if (-not $ready) { Write-Log 'ERROR: Docker engine did not become ready within 5 minutes.'; exit 2 }

try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up -d failed' }
    Write-Log 'Core BCS services are up.'

    # Start the optional browser bot only when explicitly enabled and configured.
    $envFile = Join-Path $ProjectRoot '.env'
    $envLines = if (Test-Path $envFile) { Get-Content $envFile } else { @() }
    $botExpected = ($envLines | Where-Object { $_ -match '^VKSBOT_EXPECTED\s*=\s*true\s*$' } | Select-Object -First 1)
    $botToken = ($envLines | Where-Object { $_ -match '^BOT_TOKENS\s*=\s*\S+' } | Select-Object -First 1)
    if ($botExpected -and $botToken) {
        docker compose --profile bot up -d vks-bot
        if ($LASTEXITCODE -ne 0) { Write-Log 'WARNING: optional VKS bot did not start.' }
    }
} catch { Write-Log "ERROR: $($_.Exception.Message)"; exit 3 }
Write-Log 'Startup recovery completed.'
exit 0
