# Починка .env: PowerShell дописал в конец файла кусок в UTF-16LE (нулевые байты),
# из-за чего docker compose падает: "unexpected character \x00".
# Запуск из папки проекта:  powershell -ExecutionPolicy Bypass -File .\fix-env.ps1
$ErrorActionPreference = 'Stop'
$p = Join-Path (Get-Location) '.env'
if (-not (Test-Path $p)) { Write-Host "[fix-env] .env не найден в $(Get-Location)" -ForegroundColor Red; exit 1 }

$bak = "$p.bak.$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
Copy-Item $p $bak
Write-Host "[fix-env] резервная копия: $bak"

$bytes = [System.IO.File]::ReadAllBytes($p)

# Вариант A: весь файл UTF-16 (с BOM FF FE или без)
$asU16 = [System.Text.Encoding]::Unicode.GetString($bytes)
if ($asU16 -match 'SITE_IP|APP_|DB_' -and $asU16.IndexOf([char]0) -lt 0) {
    $txt = $asU16
} else {
    # Вариант B: гибрид — ищем границу «последний перевод строки перед серией нулей»
    $idx = -1
    for ($i = 0; $i -lt $bytes.Length - 3; $i++) {
        if ($bytes[$i] -eq 0 -and $bytes[$i+1] -eq 0 -and $bytes[$i+2] -eq 0 -and $bytes[$i+3] -eq 0) { $idx = $i; break }
    }
    if ($idx -lt 0) {
        # нулей нет — файл уже нормальный, просто приведём CRLF->LF и уберём BOM
        $txt = [System.Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF)
    } else {
        $utf8Part = [System.Text.Encoding]::UTF8.GetString($bytes[0..($idx-1)])
        # отрезаем хвост так, чтобы он был чётной длины для UTF-16LE:
        # идём назад от $idx до предыдущего \n (0x0A) в UTF-8-части
        $nl = $utf8Part.LastIndexOf("`n")
        if ($nl -ge 0) {
            $cutUtf8 = $utf8Part.Substring(0, $nl + 1)
            $tailBytes = $bytes[($cutUtf8.Length)..($bytes.Length-1)]
            if ($tailBytes.Length % 2 -ne 0) { $tailBytes = $tailBytes[0..($tailBytes.Length-2)] }
            $tail = [System.Text.Encoding]::Unicode.GetString($tailBytes)
            $txt = $cutUtf8 + $tail
        } else {
            $txt = $utf8Part + ($bytes[$idx..($bytes.Length-1)] | ForEach-Object { if ($_ -ne 0) { [char]$_ } }) -join ''
        }
    }
}

# финальная нормализация: убираем все нули/BOM/CR, лишние пустые строки
$txt = $txt.Replace([string][char]0, '').Replace([string][char]0xFEFF, '')
$txt = $txt -replace "`r`n", "`n" -replace "`r", "`n"
$txt = $txt.Trim() + "`n"

[System.IO.File]::WriteAllText($p, $txt, (New-Object System.Text.UTF8Encoding($false)))

# проверка
$check = [System.IO.File]::ReadAllBytes($p)
$bad = $check | Where-Object { $_ -eq 0 }
if ($bad.Count -gt 0) { Write-Host "[fix-env] ОШИБКА: нули остались ($($bad.Count) шт.)" -ForegroundColor Red; exit 1 }
Write-Host "[fix-env] OK: .env пересохранён в UTF-8 (LF), нулей нет."
Write-Host "[fix-env] Проверьте содержимое: notepad .env  (строки VITE_VKS_AUTOBOT / BOT_TOKENS должны читаться)"
Write-Host "[fix-env] Затем: docker compose config --quiet  &&  docker compose build frontend  &&  docker compose up -d frontend"
