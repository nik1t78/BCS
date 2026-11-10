<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Индексы под горячие запросы:
 *  - meetings (date, status) — выборка встреч на день в «Свободных залах»
 *    (allAvailability фильтрует по статусу scheduled/in-progress);
 *  - meetings (room, date) — группировка занятости по залу;
 *  - bot_logs (created_at) — сортировка/фильтр дневника ВКС-бота + чистка старых.
 *
 * Существующие индексы не дублируются (проверка через SHOW INDEX).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->addIndex('meetings', 'idx_meetings_date_status', ['date', 'status']);
        $this->addIndex('meetings', 'idx_meetings_room_date', ['room', 'date']);
        $this->addIndex('bot_logs', 'idx_bot_logs_created_at', ['created_at']);
    }

    public function down(): void
    {
        foreach ([
            'meetings' => ['idx_meetings_date_status', 'idx_meetings_room_date'],
            'bot_logs' => ['idx_bot_logs_created_at'],
        ] as $table => $names) {
            if (!Schema::hasTable($table)) continue;
            foreach ($names as $name) {
                try { DB::statement("ALTER TABLE {$table} DROP INDEX {$name}"); } catch (\Throwable) {}
            }
        }
    }

    private function addIndex(string $table, string $name, array $columns): void
    {
        if (!Schema::hasTable($table)) return;
        $exists = collect(DB::select("SHOW INDEX FROM `{$table}`"))
            ->contains(fn ($i) => $i->{array_key_exists('Key_name', (array) $i) ? 'Key_name' : 'key_name'} === $name);
        if ($exists) return;
        $cols = '`' . implode('`,`', $columns) . '`';
        DB::statement("ALTER TABLE `{$table}` ADD INDEX `{$name}` ({$cols})");
    }
};
