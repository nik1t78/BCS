<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_polls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained('meetings')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('question', 255);
            $table->json('options');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['meeting_id', 'created_at']);
        });

        Schema::create('meeting_poll_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poll_id')->constrained('meeting_polls')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('option_index');
            $table->timestamps();
            $table->unique(['poll_id', 'user_id']);
            $table->index(['poll_id', 'option_index']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_poll_votes');
        Schema::dropIfExists('meeting_polls');
    }
};
