$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogDir = Join-Path $ProjectRoot 'ops\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir 'backup-copy.log'
function Write-Log($Message) { Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" }
Set-Location $ProjectRoot
$destinationFile = Join-Path $PSScriptRoot 'backup-destination.txt'
$destination = if (Test-Path $destinationFile) { (Get-Content $destinationFile -Raw).Trim() } else { '' }
if ([string]::IsNullOrWhiteSpace($destination)) { Write-Log 'External backup destination is not configured; skipped.'; exit 0 }
if (-not (Test-Path $destination)) { New-Item -ItemType Directory -Force -Path $destination | Out-Null }

# Run a fresh backup here too: if the machine was powered off at the Laravel
# scheduler's 02:30 slot, Task Scheduler's StartWhenAvailable still catches up.
docker compose exec -T backend php artisan db:backup --keep=14
if ($LASTEXITCODE -ne 0) { throw 'Unable to create a fresh database backup before off-host copy.' }

docker inspect vks-backend *> $null
if ($LASTEXITCODE -ne 0) { throw 'Backend container is not available.' }
$temp = Join-Path $env:TEMP ('bcs-backup-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    docker cp 'vks-backend:/var/www/html/storage/app/backups/.' $temp
    if ($LASTEXITCODE -ne 0) { throw 'Unable to copy backup files from Docker volume.' }
    $verified = 0
    Get-ChildItem $temp -Filter 'backup-*.sql.gz' -File | ForEach-Object {
        $archive = $_
        $metaFile = "$($archive.FullName).json"
        if (-not (Test-Path $metaFile)) { Write-Log "Skipped without metadata: $($archive.Name)"; return }
        $meta = Get-Content $metaFile -Raw | ConvertFrom-Json
        $actual = (Get-FileHash -Path $archive.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne ([string]$meta.sha256).ToLowerInvariant()) { Write-Log "ERROR: SHA-256 mismatch: $($archive.Name)"; return }
        Copy-Item $archive.FullName -Destination $destination -Force
        Copy-Item $metaFile -Destination $destination -Force
        $verified++
    }
    if ($verified -eq 0) { throw 'No verified SQL backups found to copy.' }
    Get-ChildItem $destination -Filter 'backup-*.sql.gz' -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | ForEach-Object {
        Remove-Item $_.FullName -Force
        if (Test-Path "$($_.FullName).json") { Remove-Item "$($_.FullName).json" -Force }
    }
    Write-Log "Copied $verified verified backup(s) to $destination."
} finally { Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue }
