<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Протокол встречи: обсуждение, решения, ответственные
        Schema::create('meeting_minutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('discussion')->nullable();   // обсуждение после совещания
            $table->text('decisions')->nullable();     // принятые решения
            $table->string('responsible')->nullable(); // ответственные (текст)
            $table->timestamps();

            $table->index(['meeting_id', 'created_at']);
        });

        // Задачи / action items внутри встречи
        Schema::create('meeting_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->onDelete('set null');
            $table->date('deadline')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'done'])->default('pending');
            $table->timestamps();

            $table->index(['meeting_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_tasks');
        Schema::dropIfExists('meeting_minutes');
    }
};
