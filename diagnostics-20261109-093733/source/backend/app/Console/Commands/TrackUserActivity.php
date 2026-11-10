<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Продуктовая аналитика: ежедневный DAU/MAU по журналу действий user_activity.
 * Использование: php artisan analytics:daily [--date=YYYY-MM-DD]
 */
class TrackUserActivity extends Command
{
    protected $signature = 'analytics:daily {--date= : Дата отчёта YYYY-MM-DD (по умолчанию сегодня)}';
    protected $description = 'Рассчитать DAU/MAU и записать снимок в таблицу daily_stats';

    public function handle(): int
    {
        if (!DB::getSchemaBuilder()->hasTable('user_activity')) {
            $this->warn('Таблица user_activity отсутствует — выполните php artisan migrate.');
            return self::FAILURE;
        }

        $date = $this->option('date') ?: now()->toDateString();
        $dayStart = date("{$date} 00:00:00");
        $dayEnd = date("{$date} 23:59:59");
        $mauSince = date('Y-m-d 00:00:00', strtotime($date . ' -29 days'));

        $dau = DB::table('user_activity')->whereBetween('created_at', [$dayStart, $dayEnd])->distinct('user_id')->count('user_id');
        $mau = DB::table('user_activity')->where('created_at', '>=', $mauSince)->distinct('user_id')->count('user_id');
        $actions = DB::table('user_activity')->whereBetween('created_at', [$dayStart, $dayEnd])->count();

        DB::table('daily_stats')->upsert(
            ['date' => $date, 'dau' => $dau, 'mau' => $mau, 'actions' => $actions,
             'updated_at' => now(), 'created_at' => now()],
            ['date']
        );

        $this->info("DAU={$dau} MAU={$mau} actions={$actions} ({$date})");
        return self::SUCCESS;
    }
}
