<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Дневник работы Selenium-бота ВКС (пункт 6 плана): каждая попытка
     * создания/проверки ссылки пишется сюда — время, встреча, результат,
     * длительность, текст ошибки. Страница /admin/bot-log фильтрует записи,
     * SLA-метрики (пункт 7) считаются отсюда же.
     */
    public function up(): void
    {
        Schema::create('bot_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->nullable()->index();
            $table->string('action', 32)->index();          // create | check | autopilot
            $table->string('trigger', 32)->default('queue'); // queue | manual | cron
            $table->boolean('success')->default(false)->index();
            $table->string('link', 500)->nullable();
            $table->text('error')->nullable();
            $table->unsignedInteger('duration_ms')->default(0);
            $table->timestamps();

            $table->index(['created_at', 'success']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bot_logs');
    }
};
