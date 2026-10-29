<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Журнал посещаемости экранов ТВ: строка создаётся при первой «живой»
     * проверке токена (поллинг /api/tv/{room}/next) и обновляется каждым
     * последующим запросом того же экрана. Даёт: кто подключался, когда,
     * сколько длилась сессия просмотра (last_seen_at - first_seen_at),
     * сколько уникальных экранов за день.
     */
    public function up(): void
    {
        Schema::create('tv_view_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->index();
            // Стабильный id экземпляра экрана: генерируется на телевизоре в
            // sessionStorage и приходит параметром ?screen=... (опционально).
            // Без него все поллы одного зала сливаются в одну запись по хэшу токена.
            $table->string('screen_id', 64)->nullable();
            $table->char('token_hash', 64)->index();   // sha256 токена — сам токен не храним
            $table->string('ip', 45)->nullable();      // IPv4/IPv6
            $table->string('ua', 200)->nullable();     // user-agent браузера ТВ
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->unsignedInteger('polls')->default(1);
            $table->timestamps();

            $table->unique(['room_id', 'token_hash', 'screen_id'], 'tv_view_unique');
            $table->index(['last_seen_at', 'room_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tv_view_logs');
    }
};
