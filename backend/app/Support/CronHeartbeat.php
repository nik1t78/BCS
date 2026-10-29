<?php

namespace App\Support;

/**
 * Единая точка записи heartbeat планировщика (контейнер scheduler).
 *
 * «Статус системы» (system:monitor / /api/admin/system-status) различает
 * два сервиса по разным сигналам:
 *   - queue-worker  -> storage/app/heartbeat/queue_worker_heartbeat (см. QueueHeartbeat);
 *   - scheduler     -> файл, путь которого возвращает path() ниже.
 *
 * Запись атомарна (tempnam + rename), чтобы параллельные циклы schedule:run
 * не оставляли пустой файл (filemtime() = 0 выглядел как «Ещё не запускался»).
 */
class CronHeartbeat
{
    /** Абсолютный путь файла heartbeat планировщика. */
    public static function path(): string
    {
        return storage_path('logs/cron_heartbeat.log');
    }

    /** Записать текущий unix timestamp. Возвращает true при успехе. */
    public static function write(?int $ts = null): bool
    {
        $ts ??= time();
        $target = self::path();
        $dir = dirname($target);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $tmp = @tempnam($dir, 'hb');
        if ($tmp === false || @file_put_contents($tmp, (string) $ts) === false) {
            if ($tmp !== false && is_file($tmp)) {
                @unlink($tmp);
            }
            return false;
        }
        @chmod($tmp, 0775);

        return @rename($tmp, $target);
    }

    /** Unix timestamp последней записи или 0, если файла нет/пустой. */
    public static function lastTs(): int
    {
        $target = self::path();
        if (!is_file($target)) {
            return 0;
        }
        clearstatcache(true, $target);
        $content = (int) @file_get_contents($target);

        return $content > 0 ? $content : (int) @filemtime($target);
    }
}
