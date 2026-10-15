# -*- requires: saved as UTF-8 WITH BOM so PowerShell 5.1 reads Cyrillic correctly -*-
# Fix .env: PowerShell appended a UTF-16LE chunk (null bytes) -> docker compose fails
# with "unexpected character \x00". This script converts the whole file to clean UTF-8 (LF).
# Run from project folder:  powershell -ExecutionPolicy Bypass -File .\fix-env.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$p = Join-Path (Get-Location) '.env'
if (-not (Test-Path $p)) { Write-Host "[fix-env] .env not found in $(Get-Location)" -ForegroundColor Red; exit 1 }

$bak = "$p.bak.$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
Copy-Item $p $bak
Write-Host "[fix-env] backup: $bak"

$bytes = [System.IO.File]::ReadAllBytes($p)

# strip UTF-8 BOM if present
$start = 0
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $start = 3 }

# find first null byte (start of the UTF-16LE tail written by PowerShell Add-Content)
$idx = -1
for ($i = $start; $i -lt $bytes.Length; $i++) {
    if ($bytes[$i] -eq 0) { $idx = $i; break }
}

$txt = ''
if ($idx -lt 0) {
    # no nulls at all -> file is already fine, just normalize line endings
    $txt = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $bytes.Length - $start)
} else {
    # hybrid: UTF-8 head + UTF-16LE tail. The head must end on a newline before nulls.
    $headLen = $idx
    # trim head back to the last complete line
    $headStr = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $headLen - $start)
    $nl = $headStr.LastIndexOf("`n")
    if ($nl -ge 0) {
        $cutAbs = $start + $nl + 1
    } else {
        $cutAbs = $start
    }
    $txt = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $cutAbs - $start)

    # decode the UTF-16LE tail (skip possible CRLF bytes glued before it)
    $tailBytes = @($bytes[$cutAbs..($bytes.Length-1)])
    if ($tailBytes.Count % 2 -ne 0) { $tailBytes = @($tailBytes[0..($tailBytes.Count-2)]) }
    if ($tailBytes.Count -gt 0) {
        $tail = [System.Text.Encoding]::Unicode.GetString([byte[]]$tailBytes)
        $txt += $tail
    }
}

# final normalization: remove all NUL/BOM/CR, collapse blank lines
$txt = $txt.Replace([string][char]0, '').Replace([string][char]0xFEFF, '')
$txt = $txt -replace "`r`n", "`n" -replace "`r", "`n"
$txt = $txt.Trim() + "`n"

[System.IO.File]::WriteAllText($p, $txt, (New-Object System.Text.UTF8Encoding($false)))

# verify
$check = [System.IO.File]::ReadAllBytes($p)
$bad = @($check | Where-Object { $_ -eq 0 })
if ($bad.Count -gt 0) { Write-Host "[fix-env] ERROR: nulls remain ($($bad.Count))" -ForegroundColor Red; exit 1 }
if ((Get-Content $p -Raw) -notmatch 'SITE_IP|APP_ENV|DB_') {
    Write-Host "[fix-env] WARNING: .env looks empty/corrupted after fix. Restore from backup: $bak" -ForegroundColor Yellow
    exit 1
}
Write-Host "[fix-env] OK: .env re-saved as UTF-8 (LF), no null bytes."
Write-Host "[fix-env] Check content: notepad .env  (lines VITE_VKS_AUTOBOT / BOT_TOKENS must be readable)"
Write-Host "[fix-env] Then run deploy again:  bash ./deploy.sh"
