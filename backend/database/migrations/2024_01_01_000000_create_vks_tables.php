<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('role', ['admin', 'moderator', 'user'])->default('user');
            $table->string('phone', 20)->nullable();
            $table->string('department')->nullable();
            $table->string('position')->nullable();
            $table->string('avatar')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login')->nullable();
            $table->rememberToken();
            $table->timestamps();

            $table->index('email');
            $table->index('role');
            $table->index('is_active');
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->foreignId('organizer_id')->constrained('users')->onDelete('cascade');
            $table->json('participants')->nullable();
            $table->json('participant_emails')->nullable();
            $table->string('link', 500)->nullable();
            $table->string('room')->nullable();
            $table->enum('status', ['scheduled', 'in-progress', 'completed', 'cancelled'])->default('scheduled');
            $table->integer('reminder_minutes')->default(15);
            $table->enum('recurring', ['none', 'daily', 'weekly', 'monthly'])->default('none');
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->boolean('is_private')->default(false);
            $table->timestamps();

            $table->index(['date', 'start_time']);
            $table->index('organizer_id');
            $table->index('status');
            $table->index('priority');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('meeting_id')->nullable()->constrained()->onDelete('cascade');
            $table->text('message');
            $table->enum('type', ['reminder', 'starting', 'info', 'warning', 'user-added']);
            $table->boolean('read')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'read']);
            $table->index('type');
            $table->index('created_at');
        });

        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');
            $table->boolean('sound_enabled')->default(true);
            $table->boolean('browser_notifications')->default(true);
            $table->integer('default_reminder_minutes')->default(15);
            $table->time('work_hours_start')->default('09:00:00');
            $table->time('work_hours_end')->default('18:00:00');
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_settings');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('meetings');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');
    }
};
