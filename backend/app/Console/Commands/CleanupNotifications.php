<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Notification;
use Carbon\Carbon;

class CleanupNotifications extends Command
{
    protected $signature = 'notifications:cleanup';
    protected $description = 'Очистка старых уведомлений (старше 30 дней)';

    public function handle()
    {
        $this->info('Начало очистки старых уведомлений...');

        $thirtyDaysAgo = Carbon::now()->subDays(30);
        
        $deleted = Notification::where('created_at', '<', $thirtyDaysAgo)->delete();

        $this->info("Удалено {$deleted} старых уведомлений.");

        return 0;
    }
}
