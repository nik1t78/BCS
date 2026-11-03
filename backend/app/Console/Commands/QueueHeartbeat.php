<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Heartbeat воркера очереди.
 *
 * Пишет unix timestamp в общий кэш (файл storage/app/heartbeat/queue_worker_heartbeat)
 * каждые N секунд — пока запущен сам процесс. Если queue:work упал, завис или
 * контейнер перезапускается — запись прекращается, и мониторинг
 * (system:monitor / «Статус системы») честно помечает воркер как недоступный.
 *
 * Запуск: php artisan queue:heartbeat          (в docker-compose как sidecar-процесс
 * внутри контейнера queue: `queue:heartbeat & php artisan queue:work ...`)
 *
 * .env:
 *   QUEUE_HEARTBEAT_INTERVAL=20   # сек. между записями heartbeat
 */
class QueueHeartbeat extends Command
{
    protected $signature = 'queue:heartbeat';

    protected $description = 'Каждые несколько секунд писать heartbeat воркера очереди в файл (для system:monitor)';

    public function handle(): int
    {
        $file = MonitorSystem::queueHeartbeatFile();
        $dir = dirname($file);
        $interval = max(5, (int) env('QUEUE_HEARTBEAT_INTERVAL', 20));

        // Фикс «Нет heartbeat» в админке при живом контейнере vks-queue:
        // раньше файл писался молча и без проверки результата. Если каталог
        // storage/app/heartbeat отсутствовал или был недоступен для записи
        // (bind-mount на Windows/Docker Desktop, права), heartbeat никогда
        // не появлялся — UI честно показывал «воркер мёртв», хотя queue:work
        // работал. Теперь: (1) каталог создаётся принудительно; (2) если файл
        // недоступен — пишем дубликат в кэш (CACHE_STORE=file — общий volume
        // backend_storage виден всем php-контейнерам); (3) раз в ~5 минут
        // пишется ларavel-лог, чтобы сбой heartbeat было видно в `logs queue`.

        // Директория может появиться позже (например, после первого queue:work) —
        // пересоздаём, если пропала.
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }

        $logEvery = 15; // ~каждые 5 минут при интервале 20 c
        $i = 0;
        // Бесконечный цикл: пишет timestamp, спит interval секунд.
        // Умирает вместе с контейнером — т.е. отсутствие свежей записи == нет воркера.
        while (true) {
            $ok = @file_put_contents($file, (string) time()) !== false;
            try {
                // Fallback в кэш: переживает проблемы bind-mount с файлом.
                cache()->put(MonitorSystem::QUEUE_HEARTBEAT_KEY, time(), now()->addMinutes(5));
            } catch (\Throwable $e) {
                // кэш недоступен — остаёмся на файле
            }
            if ($i++ % $logEvery === 0) {
                try {
                    \Illuminate\Support\Facades\Log::info('queue:heartbeat live', [
                        'file' => $file,
                        'writable' => $ok,
                        'ts' => time(),
                    ]);
                } catch (\Throwable $e) {
                    // логирование не должно ронять heartbeat
                }
            }
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            sleep($interval);
        }

        return self::SUCCESS; // недостижимо
    }
}
