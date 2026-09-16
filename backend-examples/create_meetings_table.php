<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Создание таблицы конференций
     */
    public function up(): void
    {
        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->foreignId('organizer_id')->constrained('users')->onDelete('cascade');
            $table->json('participants')->nullable(); // Массив ID пользователей
            $table->json('participant_emails')->nullable(); // Массив email внешних участников
            $table->string('link')->nullable();
            $table->string('room')->nullable();
            $table->enum('status', ['scheduled', 'in-progress', 'completed', 'cancelled'])->default('scheduled');
            $table->integer('reminder_minutes')->default(15);
            $table->enum('recurring', ['none', 'daily', 'weekly', 'monthly'])->default('none');
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->boolean('is_private')->default(false);
            $table->timestamps();

            // Индексы для быстрого поиска
            $table->index(['date', 'start_time']);
            $table->index('organizer_id');
            $table->index('status');
            $table->index('priority');
        });

        // Таблица для связи пользователей и конференций (если используем belongsToMany)
        Schema::create('meeting_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['meeting_id', 'user_id']);
        });
    }

    /**
     * Удаление таблиц
     */
    public function down(): void
    {
        Schema::dropIfExists('meeting_user');
        Schema::dropIfExists('meetings');
    }
};
