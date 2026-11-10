<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Пункт 5 плана: экран ожидания в зале /tv/{room}. Таблице rooms нужен
 * постоянный публичный токен — он попадает в URL телевизора и позволяет
 * читать расписание зала БЕЗ логина (только чтение, без персональных данных).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('rooms', 'tv_token')) {
                $table->string('tv_token', 64)->nullable()->unique();
            }
        });

        // Заполнить токены уже существующим активным залам.
        \App\Models\Room::whereNull('tv_token')->each(function (\App\Models\Room $room) {
            $room->forceFill(['tv_token' => bin2hex(random_bytes(16))])->saveQuietly();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            if (Schema::hasColumn('rooms', 'tv_token')) {
                $table->dropUnique(['tv_token']);
                $table->dropColumn('tv_token');
            }
        });
    }
};
