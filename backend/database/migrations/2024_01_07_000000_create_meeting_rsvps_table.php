<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Подтверждение присутствия (RSVP): «приду / не приду / под вопросом».
 * Организатор видит сводку по всем участникам.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_rsvps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('response', ['yes', 'no', 'maybe'])->default('maybe');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->unique(['meeting_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_rsvps');
    }
};
