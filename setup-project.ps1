<#
.SYNOPSIS
    Подготовка проекта к запуску через Docker Desktop на Windows.

.DESCRIPTION
    Скрипт нужен один раз после того, как проект скачан архивом (без git) либо
    если в папке backend/ не хватает каркаса Laravel (config/, storage/, artisan).

    Что делает:
      1. Копирует отсутствующие файлы конфигурации из docker/skeleton/laravel12/config
         в backend/config (существующие файлы НЕ перезаписывает).
      2. Создаёт структуру каталогов backend/storage и backend/bootstrap/cache
         (из docker/skeleton/laravel12/.staging).
      3. Создаёт backend/.env из .env.example (если его нет) и генерирует APP_KEY.
      4. Создаёт корневой .env из .env.example (если его нет) и переносит в него
         APP_KEY из backend/.env — docker-compose читает переменные именно оттуда.

    После этого достаточно выполнить:  docker compose up -d --build

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\setup-project.ps1
#>

[CmdletBinding()]
param(
    [switch]$ForceEnv   # пересоздать .env-файлы из примеров (осторожно: потеряете значения!)
)

$ErrorActionPreference = 'Stop'

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Skeleton = Join-Path $Root 'docker\skeleton\laravel12'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "    $Message" -ForegroundColor Green }
function Write-Skip([string]$Message) { Write-Host "    $Message" -ForegroundColor DarkGray }

if (-not (Test-Path $Backend))  { throw "Не найден каталог $Backend. Запускайте скрипт из папки проекта." }
if (-not (Test-Path $Skeleton)) { throw "Не найден каркас $Skeleton. Проверьте целостность скачанного проекта." }

# Ключевые файлы приложения должны быть в архиве — без них Laravel не стартует.
foreach ($required in @('composer.json', 'composer.lock', 'bootstrap/app.php', 'artisan')) {
    if (-not (Test-Path (Join-Path $Backend $required))) {
        throw "В backend/ отсутствует $required — архив проекта неполный, скачайте его заново."
    }
}

Write-Step 'Проверка Docker'
try {
    docker version --format '{{.Server.Version}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Ok 'Docker отвечает'
} catch {
    Write-Warning 'Docker недоступен: запустите Docker Desktop и повторите попытку (каркас при этом всё равно будет создан).'
}

# ---------------------------------------------------------------- 1. config/
Write-Step 'Файлы конфигурации Laravel (backend/config)'
$srcConfig = Join-Path $Skeleton 'config'
$dstConfig = Join-Path $Backend 'config'
New-Item -ItemType Directory -Force -Path $dstConfig | Out-Null
foreach ($file in Get-ChildItem -Path $srcConfig -Filter '*.php' -File) {
    $target = Join-Path $dstConfig $file.Name
    if ((Test-Path $target) -and -not $ForceEnv) {
        Write-Skip "$($file.Name) — уже есть, не трогаем"
    } else {
        Copy-Item $file.FullName $target -Force
        Write-Ok "$($file.Name) — скопирован из каркаса"
    }
}

# ------------------------------------------------------- 2. storage + cache
Write-Step 'Каталоги backend/storage и backend/bootstrap/cache'
$staging = Join-Path $Skeleton '.staging'
foreach ($rel in @('storage', 'bootstrap')) {
    $srcDir = Join-Path $staging $rel
    if (-not (Test-Path $srcDir)) { continue }
    # сортируем по глубине, чтобы родительские каталоги создавались раньше
    Get-ChildItem -Path $srcDir -Recurse -Directory | Sort-Object FullName | ForEach-Object {
        $relative = $_.FullName.Substring($srcDir.Length).TrimStart('\', '/')
        $newDir   = if ($relative) { Join-Path (Join-Path $Backend $rel) $relative } else { Join-Path $Backend $rel }
        if (Test-Path $newDir) {
            Write-Skip "$rel\$relative — уже есть"
        } else {
            New-Item -ItemType Directory -Force -Path $newDir | Out-Null
            Write-Ok "создан $rel\$relative"
        }
    }
}

# ------------------------------------------------------------ 3. backend/.env
Write-Step 'backend/.env'
$backendEnv     = Join-Path $Backend '.env'
$backendExample = Join-Path $Backend '.env.example'
if ($ForceEnv -and (Test-Path $backendEnv)) { Remove-Item $backendEnv -Force }
if (-not (Test-Path $backendEnv)) {
    if (-not (Test-Path $backendExample)) { throw "Нет ни $backendEnv, ни $backendExample" }
    Copy-Item $backendExample $backendEnv
    Write-Ok 'создан из .env.example'
} else {
    Write-Skip 'уже существует'
}

# APP_KEY внутри backend/.env (нужен artisan-командам внутри контейнера)
$envText  = Get-Content $backendEnv -Raw
$appKeyIn = [regex]::Match($envText, '(?m)^APP_KEY=(.*)$')
if (-not $appKeyIn.Success -or [string]::IsNullOrWhiteSpace($appKeyIn.Groups[1].Value)) {
    Write-Step 'Генерация APP_KEY (php artisan key:generate)'
    $composeUp = @(docker compose ps --services --status running 2>$null)
    if ($composeUp -contains 'backend') {
        $key = (docker compose exec -T backend php artisan key:generate --show 2>$null | Select-Object -Last 1)
    } else {
        $key = (docker compose run --rm backend php artisan key:generate --show 2>$null | Select-Object -Last 1)
    }
    if ($key -match '^(base64:)?[A-Za-z0-9+/=]{20,}$') {
        $key  = $key.Trim()
        $text = Get-Content $backendEnv -Raw
        if ([regex]::IsMatch($text, '(?m)^APP_KEY=')) {
            $newText = [regex]::Replace($text, '(?m)^APP_KEY=.*$', "APP_KEY=$key")
        } else {
            $newText = $text.TrimEnd() + "`nAPP_KEY=$key`n"
        }
        Set-Content -Path $backendEnv -Value $newText -NoNewline -Encoding ascii
        Write-Ok "APP_KEY записан в backend/.env"
    } else {
        Write-Warning 'APP_KEY получить не удалось (образ ещё не собран?). Выполните `docker compose build backend` и повторите скрипт.'
    }
} else {
    Write-Skip 'APP_KEY уже задан'
}

# ----------------------------------------------------------- 4. корневой .env
Write-Step '.env рядом с docker-compose.yml'
$rootEnv     = Join-Path $Root '.env'
$rootExample = Join-Path $Root '.env.example'
if ($ForceEnv -and (Test-Path $rootEnv)) { Remove-Item $rootEnv -Force }
if (-not (Test-Path $rootEnv)) {
    if (Test-Path $rootExample) {
        Copy-Item $rootExample $rootEnv
        Write-Ok 'создан из .env.example'
    } else {
        # В скачанном архиве .env.example может отсутствовать — создаём минимальный,
        # иначе docker compose не сможет интерполировать переменные.
        @'
# Сайт по адресу http://<IP машины>/ без порта — Nginx на 80 порту
HTTP_PORT=80
listen_ip=0.0.0.0
APP_KEY=
APP_ENV=production
APP_DEBUG=false
DB_DATABASE=vks_schedule
DB_USERNAME=vks_user
DB_PASSWORD=vks_2026
DB_ROOT_PASSWORD=vks_2026_root
REDIS_PASSWORD=vks_2026_redis
MESSENGER=max
MAX_BOT_TOKEN=
'@ | Set-Content -Path $rootEnv -Encoding ascii
        Write-Ok 'создан минимальный .env (нет .env.example в архиве)'
    }
} else {
    Write-Skip 'уже существует'
}

# IP этой машины — чтобы Laravel (APP_URL) и ссылки генерировались по http://<IP>/
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
                   $_.InterfaceAlias -notmatch 'vEthernet|Docker|WSL|Loopback' } |
    Sort-Object -Property SkipSourceRouterCount).IPAddress | Select-Object -First 1
if ($lanIp) {
    foreach ($f in @($rootEnv, $backendEnv)) {
        $t = Get-Content $f -Raw
        $t = if ($t -match '(?m)^SITE_IP=.*$') {
            [regex]::Replace($t, '(?m)^SITE_IP=.*$', "SITE_IP=$lanIp")
        } else { $t.TrimEnd() + "`nSITE_IP=$lanIp`n" }
        Set-Content -Path $f -Value $t -NoNewline -Encoding ascii
    }
    $bt = Get-Content $backendEnv -Raw
    if ($bt -notmatch '(?m)^APP_URL=..*$') {
        $bt = $bt.TrimEnd() + "`nAPP_URL=http://$lanIp`n"
        Set-Content -Path $backendEnv -Value $bt -NoNewline -Encoding ascii
    }
    Write-Ok "SITE_IP=$lanIp записан в .env (сайт будет по http://$lanIp/)"
}

# docker-compose берёт APP_KEY/пароли из корневых environment:, синхронизируем их
# с backend/.env, чтобы значения не разъезжались.
$keyMatch = [regex]::Match((Get-Content $backendEnv -Raw), '(?m)^APP_KEY=(.+?)\s*$')
if ($keyMatch.Success) {
    $rootText  = Get-Content $rootEnv -Raw
    $rootKeyIn = [regex]::Match($rootText, '(?m)^APP_KEY=(.*)$')
    if (-not $rootKeyIn.Success -or [string]::IsNullOrWhiteSpace($rootKeyIn.Groups[1].Value)) {
        $value = $keyMatch.Groups[1].Value.Trim()
        $updated = if ($rootKeyIn.Success) {
            [regex]::Replace($rootText, '(?m)^APP_KEY=.*$', "APP_KEY=$value")
        } else {
            $rootText.TrimEnd() + "`nAPP_KEY=$value`n"
        }
        Set-Content -Path $rootEnv -Value $updated -NoNewline -Encoding ascii
        Write-Ok 'APP_KEY скопирован из backend/.env в корневой .env'
    } else {
        Write-Skip 'APP_KEY в корневом .env уже задан'
    }
}

Write-Host ''
Write-Host 'Готово. Следующая команда:' -ForegroundColor Cyan
Write-Host '    docker compose up -d --build'
Write-Host ''
$port = '80'
if (Test-Path '.env') {
    $m = Select-String -Path '.env' -Pattern '^HTTP_PORT=(.+)$' | Select-Object -Last 1
    if ($m) { $port = $m.Matches[0].Groups[1].Value.Trim() }
}
# IP этой машины (не Docker-адаптеров) — чтобы пользователи открывали http://<IP>/
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
                   $_.InterfaceAlias -notmatch 'vEthernet|Docker|WSL|Loopback' } |
    Sort-Object -Property SkipSourceRouterCount).IPAddress | Select-Object -First 1
if ($port -eq '80') {
    Write-Host "Для пользователей сайт будет по адресу: http://${ip}/" -ForegroundColor Cyan
} else {
    Write-Host "Для пользователей сайт будет по адресу: http://${ip}:$port" -ForegroundColor Cyan
    Write-Host 'Чтобы адрес был без порта (http://IP/), поставьте в .env HTTP_PORT=80' -ForegroundColor Yellow
}
Write-Host 'Если доступ из сети не работает — разрешите входящий TCP-порт' "$port" 'в брандмауэре Windows:'
Write-Host "    New-NetFirewallRule -DisplayName 'VKS web' -Direction Inbound -Protocol TCP -LocalPort $port"
Write-Host ''
Write-Host 'Перед первым запуском проверьте в .env значения DB_PASSWORD / DB_ROOT_PASSWORD / REDIS_PASSWORD,' -ForegroundColor Yellow
Write-Host 'а также MAX_BOT_TOKEN (если нужны уведомления в MAX).'
