# Первый запуск / обновление BCS на Windows 10/11 + Docker Desktop.
# Скрипт не удаляет контейнерные тома, папку docker/mysql/data или существующий .env.
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function New-RandomHex([int]$ByteCount = 32) {
    $bytes = New-Object byte[] $ByteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}
function New-AppKey {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return 'base64:' + [Convert]::ToBase64String($bytes)
}

$EnvPath = Join-Path $ProjectRoot '.env'
if (-not (Test-Path $EnvPath)) {
    $TemplatePath = Join-Path $ProjectRoot '.env.example'
    if (-not (Test-Path $TemplatePath)) { throw 'Не найден .env.example.' }
    $content = [System.IO.File]::ReadAllText($TemplatePath, [System.Text.Encoding]::UTF8)
    $content = [regex]::Replace($content, '(?m)^APP_KEY=.*$', ('APP_KEY=' + (New-AppKey)))
    $content = [regex]::Replace($content, '(?m)^DB_PASSWORD=.*$', ('DB_PASSWORD=' + (New-RandomHex 32)))
    $content = [regex]::Replace($content, '(?m)^DB_ROOT_PASSWORD=.*$', ('DB_ROOT_PASSWORD=' + (New-RandomHex 32)))
    $content = [regex]::Replace($content, '(?m)^REDIS_PASSWORD=.*$', ('REDIS_PASSWORD=' + (New-RandomHex 32)))
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($EnvPath, $content, $utf8NoBom)
    Write-Host 'Создан .env с уникальными секретами. Файл не публикуйте и не отправляйте.' -ForegroundColor Green
} else {
    Write-Host 'Найден существующий .env — настройки и пароли не изменяю.' -ForegroundColor Cyan
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI не найден. Установите и запустите Docker Desktop.' }
$composeVersion = docker compose version 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Не найден Docker Compose v2. Обновите Docker Desktop.' }
Write-Host $composeVersion

Write-Host 'Проверяю Docker Engine...' -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Engine недоступен. Запустите Docker Desktop, дождитесь статуса Engine running и повторите запуск.' }

Write-Host 'Проверяю .env и docker-compose.yml...' -ForegroundColor Cyan
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Конфигурация Compose не прошла проверку. Проверьте обязательные значения в .env.' }

Write-Host 'Собираю и запускаю BCS. Первый запуск может занять продолжительное время...' -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать/запустить основные сервисы. Посмотрите: docker compose logs --tail=150' }

Write-Host 'Публикую статические файлы Laravel для Nginx...' -ForegroundColor Cyan
docker compose run --rm --no-deps backend-assets
if ($LASTEXITCODE -ne 0) { throw 'Не удалось скопировать backend public assets.' }

Write-Host 'Применяю миграции и создаю storage-ссылку...' -ForegroundColor Cyan
docker compose exec -T backend php artisan migrate --force
if ($LASTEXITCODE -ne 0) { throw 'Миграции не выполнены. Данные БД не удалялись; проверьте логи backend/mysql.' }
docker compose exec -T backend php artisan storage:link --force
if ($LASTEXITCODE -ne 0) { Write-Warning 'Не удалось создать storage:link. Проверьте права/логи backend.' }

# Запускаем браузерный бот только при явном включении и наличии токена.
$envLines = Get-Content $EnvPath
$botExpected = ($envLines | Where-Object { $_ -match '^VKSBOT_EXPECTED\s*=\s*true\s*$' } | Select-Object -First 1)
$botToken = ($envLines | Where-Object { $_ -match '^BOT_TOKENS\s*=\s*\S+' } | Select-Object -First 1)
if ($botExpected -and $botToken) {
    docker compose --profile bot up -d vks-bot
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Основная система запущена, но VKS-бот не стартовал. Проверьте docker compose logs vks-bot.' }
}

Write-Host ''
Write-Host 'Сервисы BCS запущены. Состояние:' -ForegroundColor Green
docker compose ps
$siteLine = $envLines | Where-Object { $_ -match '^SITE_IP=' } | Select-Object -First 1
$siteIp = if ($siteLine) { ($siteLine -split '=', 2)[1].Trim() } else { 'localhost' }
Write-Host "Откройте в браузере: http://$siteIp/" -ForegroundColor Green
Write-Host 'Если адрес SITE_IP отличается от адреса сервера, измените SITE_IP в .env и повторите запуск.' -ForegroundColor Yellow
Write-Host 'Не выполняйте docker compose down -v: это может удалить данные.' -ForegroundColor Yellow
