<?php

/**
 * Аналог `php artisan package:discover` для этапа docker-сборки.
 *
 * Почему отдельный скрипт: composer-скрипт post-autoload-dump вызывает
 * artisan, а файла artisan в рабочей копии может не быть (это часть каркаса
 * Laravel, а не приложения) — сборка падала с "Could not open input file: artisan".
 * Здесь выполняется ровно та же логика, что и в Illuminate\Foundation\Console\PackageDiscoverCommand:
 * PackageManifest::build() пишет bootstrap/cache/packages.php (автопровайдеры,
 * алиасы и т.д.) напрямую из vendor/composer/installed.json.
 *
 * Используется на этапе RUN в backend/Dockerfile; после сборки не остаётся.
 */

$base = getcwd();
$vendor = $base.'/vendor';
$manifestPath = $base.'/bootstrap/cache/packages.php';

if (!is_file($vendor.'/autoload.php')) {
    fwrite(STDERR, "package-discovery: нет {$vendor}/autoload.php — сначала выполните composer install\n");
    exit(1);
}

require $vendor.'/autoload.php';

// Illuminate\Foundation\Application использует эти хелперы при вычислении путей
// к manifest'у (base_path()/config_path()).
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
$providers = [];
foreach ((array) require $manifestPath as $package) {
    foreach ((array) ($package['providers'] ?? []) as $provider) {
        $providers[] = $provider;
    }
}

printf(
    "package-discovery: bootstrap/cache/packages.php создан (%d пакетов, %d автопровайдеров)\n",
    count((array) require $manifestPath),
    count($providers)
);
