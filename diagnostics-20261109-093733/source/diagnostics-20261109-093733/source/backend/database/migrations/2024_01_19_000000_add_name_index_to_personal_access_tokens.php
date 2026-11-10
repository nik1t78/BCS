<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ускорение входа («сайт долго логает»).
 *
 * Sanctum при каждом createToken() и наш /auth/refresh выполняют
 * SELECT ... WHERE name LIKE 'refresh_token:%' по personal_access_tokens.
 * Без индекса по `name` это полное сканирование таблицы, которая растёт
 * с каждым входом каждого пользователя. Индекс превращает его в быстрый
 * range-scan (LIKE 'префикс%' использует обычный BTree-индекс).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('personal_access_tokens')) {
            return;
        }

        // MySQL требует лимит длины для индекса по VARCHAR(255) в utf8mb4
        // (255*4=1020 > 767/3072 в старых конфигурациях) — индексируем 64 символа,
        // префикс 'refresh_token:' в них помещается с запасом.
        $driver = DB::connection()->getDriverName();
        Schema::table('personal_access_tokens', function (Blueprint $table) use ($driver) {
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE personal_access_tokens ADD INDEX pat_name_idx (name(64))');
            } else {
                $table->index('name', 'pat_name_idx');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('personal_access_tokens')) {
            return;
        }
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropIndex('pat_name_idx');
        });
    }
};
