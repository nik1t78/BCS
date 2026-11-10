<?php

namespace App\Console\Commands;

use App\Support\CronHeartbeat;
use Illuminate\Console\Command;

/**
 * Разовая/отладочная запись heartbeat планировщика.
 * Позволяет проверить статус «Планировщик» без ожидания минутного цикла.
 */
class CronHeartbeatWrite extends Command
{
    protected $signature = 'cron:heartbeat';

    protected $description = 'Записать heartbeat планировщика вручную (для проверки статуса)';

    public function handle(): int
    {
        $ok = CronHeartbeat::write();
        $this->line($ok
            ? 'OK: записан '.CronHeartbeat::path().' ts='.time()
            : 'FAIL: не удалось записать файл (права на storage/logs?)');

        return self::SUCCESS;
    }
}
