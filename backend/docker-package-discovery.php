<?php

/**
 * Аналог `php artisan package:discover` для этапа docker-сборки.
 *
 * Файл лежит В КАТАЛОГЕ backend/ (а не в корневом docker/), потому что контекст
 * сборки backend/queue/scheduler — это ./backend: COPY docker/... из
 * backend/Dockerfile физически не может его найти
 * ("failed to compute cache key: ... /docker/laravel-package-discovery.php: not found").
 *
 * Почему отдельный скрипт: composer-скрипт post-autoload-dump вызывает artisan,
 * а каркаса Laravel (artisan + config/*) в рабочей копии может не быть — сборка
 * падала с "Could not open input file: artisan". Здесь выполняется ровно та же
 * логика, что в Illuminate\Foundation\Console\PackageDiscoverCommand:
 * PackageManifest::build() пишет bootstrap/cache/packages.php (автопровайдеры,
 * алиасы) напрямую из vendor/composer/installed.json, без бутстрапа приложения.
 *
 * Используется только на этапе RUN в backend/Dockerfile; после сборки сам файл
 * уже не нужен (в image он остаётся, но к рантайму не относится).
 */

$base = dirname(__DIR__); // /var/www/html
$vendor = $base.'/vendor';
$manifestPath = $base.'/bootstrap/cache/packages.php';

if (!is_file($vendor.'/autoload.php')) {
    fwrite(STDERR, "package-discovery: нет {$vendor}/autoload.php — сначала выполните composer install\n");
    exit(1);
}

require $vendor.'/autoload.php';

// Illuminate\Foundation\Application использует эти хелперы при вычислении
// путей к manifest'у (base_path()/config_path()).
foreach ([
    $vendor.'/laravel/framework/src/Illuminate/Collections/functions.php',
    $vendor.'/laravel/framework/src/Illuminate/Collections/helpers.php',
    $vendor.'/laravel/framework/src/Illuminate/Events/functions.php',
    $vendor.'/laravel/framework/src/Illuminate/Filesystem/functions.php',
    $vendor.'/laravel/framework/src/Illuminate/Foundation/helpers.php',
    $vendor.'/laravel/framework/src/Illuminate/Log/functions.php',
    $vendor.'/laravel/framework/src/Illuminate/Reflection/helpers.php',
    $vendor.'/laravel/framework/src/Illuminate/Support/functions.php',
    $vendor.'/laravel/framework/src/Illuminate/Support/helpers.php',
] as $helpers) {
    if (is_file($helpers)) {
        require_once $helpers;
    }
}

$cacheDir = dirname($manifestPath);
if (!is_dir($cacheDir) && !mkdir($cacheDir, 0777, true) && !is_dir($cacheDir)) {
    fwrite(STDERR, "package-discovery: не удалось создать каталог {$cacheDir}\n");
    exit(1);
}

try {
    $manifest = new Illuminate\Foundation\PackageManifest(
        new Illuminate\Filesystem\Filesystem,
        $base,
        $manifestPath
    );
    $manifest->build();
} catch (Throwable $e) {
    fwrite(STDERR, 'package-discovery: '.get_class($e).': '.$e->getMessage()."\n");
    exit(1);
}

if (!is_file($manifestPath)) {
    fwrite(STDERR, "package-discovery: файл {$manifestPath} не создан\n");
    exit(1);
}

clearstatcache(true, $manifestPath);
$packages = (array) require $manifestPath;
$providers = [];
foreach ($packages as $package) {
    foreach ((array) ($package['providers'] ?? []) as $provider) {
        $providers[] = $provider;
    }
}

printf(
    "package-discovery: bootstrap/cache/packages.php создан (%d пакетов, %d автопровайдеров)\n",
    count($packages),
    count($providers)
);
