<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Исправление 500 на /api/tv/{room}/next.
 *
 * В MySQL пустая строка '' и NULL — РАЗНЫЕ значения в UNIQUE-индексе.
 * Старый индекс tv_view_unique(room_id, token_hash, screen_id) при screen_id=''
 * давал дубликаты строк для одного экрана (firstOrNew находил одну запись,
 * а $row->save() вставлял «новую» с тем же ключом) → SQLSTATE[23000]
 * Duplicate entry → экран ТВ получал 500 на каждом поллинге.
 *
 * Нормализуем пустые screen_id в NULL и пересоздаём индекс.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('tv_view_logs')) {
            return;
        }

        DB::table('tv_view_logs')->where('screen_id', '')->update(['screen_id' => null]);

        Schema::table('tv_view_logs', function (Blueprint $table) {
            $table->dropUnique('tv_view_unique');
        });

        Schema::table('tv_view_logs', function (Blueprint $table) {
            $table->unique(['room_id', 'token_hash', 'screen_id'], 'tv_view_unique');
        });
    }

    public function down(): void
    {
        // Обратная миграция не требуется: структура та же, меняется только
        // трактовка '' -> NULL. Оставляем как no-op, чтобы откат не падал
        // на потенциальных дубликатах.
    }
};
