# Fix .env: UTF-16 -> UTF-8 (no BOM), clean NUL/CR garbage, restore comments from .env.example
# Run in PowerShell:  Set-Location D:\server\BCS ; .\fix-env.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Copy-Item .env .env.bak2 -Force

# 1) Read as UTF-16 (that's what the broken file actually is)
$text = [System.IO.File]::ReadAllText("$PSScriptRoot\.env", [System.Text.Encoding]::Unicode)

# 2) Strip all zero bytes and carriage returns (source of docker compose "\x00" error)
$text = $text -replace "`0", '' -replace "`r", ''

# 3) Load good comments from .env.example (UTF-8, tracked in git)
if (Test-Path "$PSScriptRoot\.env.example") {
    $ex = Get-Content "$PSScriptRoot\.env.example" -Encoding UTF8
    $lines = $text -split "`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $ln = $lines[$i]
        if ($ln -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            $key = $Matches[1]; $val = $Matches[2]
            # find example line for this key; keep its preceding comment block intact
            $idx = ($ex | Select-String -SimpleMatch "$key=" | Select-Object -First 1).LineNumber
            if ($idx) {
                $j = $idx - 2
                $blockStart = $idx - 1
                while ($j -ge 0 -and ($ex[$j] -match '^#' -or $ex[$j].Trim() -eq '')) {
                    if ($ex[$j] -match '^#') { $blockStart = $j } else { break }
                    $j--
                }
                # replace current value line with commented block + value
                $prefix = @()
                if ($i -gt 0 -and $lines[$i-1] -match '^#') { } else {
                    $prefix = $ex[$blockStart..($idx-1)] | ForEach-Object { ($_ -split '=')[0] }
                }
                $clean = $ex[$blockStart..($idx-1)]
                # drop trailing "=..." part from comment lines that are actual assignments
                $clean = $clean | Where-Object { $_ -match '^#' -or $_.Trim() -eq '' }
                $lines[$i] = (@($clean) + "$key=$val") -join "`n"
            }
        }
    }
    $text = $lines -join "`n"
}

# 4) Save as UTF-8 without BOM, LF line endings
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("$PSScriptRoot\.env", $text, $utf8NoBom)

# 5) Verify: no NUL bytes left
$bytes = [System.IO.File]::ReadAllBytes("$PSScriptRoot\.env")
if ($bytes -contains 0) { Write-Host "ERROR: NUL bytes still present!" -ForegroundColor Red; exit 1 }
Write-Host "OK: .env is now UTF-8, no NUL bytes." -ForegroundColor Green
Select-String -Path .env -Pattern 'VITE_VKS_AUTOBOT|VKSBOT_ENGINE|VKSBOT_URL|BOT_TOKENS|^TZ=' | ForEach-Object { $_.Line }
