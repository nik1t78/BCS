<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Причина 500 при POST /api/meetings на боевом сервере (docker, MySQL 8):
 *
 * Колонки meetings.start_time / meetings.end_time созданы как TIME без
 * указания точности — MySQL хранит их как TIME(0), т.е. БЕЗ дробной части
 * секунд. Laravel по умолчанию подключается к MySQL 8 с режимом
 * NO_ZERO_DATE/strict и при записи приводит строку '14:30' к каноническому
 * времени '14:30:00.000000'. Вставка значения с микросекундами в колонку
 * TIME(0) — это «Data truncated for column», в strict-режиме SQLSTATE
 * 01000 превращается в исключение → контроллер не доходит до валидации и
 * фронт получает 500 «Server Error» вместо понятного 422.
 *
 * Также расширяем enum status значением 'in-progress' (используется UI) —
 * на старых БД его могло не быть.
 *
 * Миграция идемпотентна: меняет тип только если точность действительно 0.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('meetings')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        if ($driver !== 'mysql') {
            // SQLite/Postgres усечения не допускают — проблема только MySQL.
            return;
        }

        $rows = DB::select(
            "SELECT COLUMN_NAME, DATETIME_PRECISION
               FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'meetings'
                AND COLUMN_NAME IN ('start_time','end_time')"
        );

        foreach ($rows as $col) {
            if ((int) $col->DATETIME_PRECISION === 0) {
                DB::statement("ALTER TABLE meetings MODIFY {$col->COLUMN_NAME} TIME NOT NULL");
            }
        }

        // status: гарантируем наличие 'in-progress' (UI переводит встречи в него)
        $statusRow = DB::select(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'meetings' AND COLUMN_NAME = 'status'"
        );
        if ($statusRow && stripos($statusRow[0]->COLUMN_TYPE, 'in-progress') === false) {
            DB::statement(
                "ALTER TABLE meetings CHANGE status status
                 ENUM('scheduled','in-progress','completed','cancelled') NOT NULL DEFAULT 'scheduled'"
            );
        }
    }

    public function down(): void
    {
        // Тип TIME(0) обратно не «сужаем» — это безопасно для существующих данных.
    }
};
