<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Таблица тегов
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('color', 7)->default('#3b82f6');
            $table->timestamps();
        });

        // Таблица шаблонов конференций
        Schema::create('meeting_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('duration_minutes')->default(60);
            $table->string('room')->nullable();
            $table->string('link')->nullable();
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->integer('reminder_minutes')->default(15);
            $table->enum('recurring', ['none', 'daily', 'weekly', 'monthly'])->default('none');
            $table->boolean('is_private')->default(false);
            $table->json('default_participants')->nullable();
            $table->timestamps();
        });

        // Таблица вложений
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('file_name');
            $table->string('file_path');
            $table->integer('file_size');
            $table->string('mime_type');
            $table->timestamps();
        });

        // Таблица истории изменений конференций
        Schema::create('meeting_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('action', ['created', 'updated', 'status_changed', 'deleted']);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45);
            $table->text('user_agent')->nullable();
            $table->timestamps();
        });

        // Таблица связи тегов и конференций
        Schema::create('meeting_tag', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->foreignId('tag_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->unique(['meeting_id', 'tag_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_tag');
        Schema::dropIfExists('meeting_history');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('meeting_templates');
        Schema::dropIfExists('tags');
    }
};
