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
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $interval = max(5, (int) env('QUEUE_HEARTBEAT_INTERVAL', 20));

        // Бесконечный цикл: пишет timestamp, спит interval секунд.
        // Умирает вместе с контейнером — т.е. отсутствие свежей записи == нет воркера.
        while (true) {
            @file_put_contents($file, (string) time());
            sleep($interval);
        }

        return self::SUCCESS; // недостижимо
    }
}
