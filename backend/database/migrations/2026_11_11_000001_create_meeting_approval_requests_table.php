<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('meeting_approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 180);
            $table->text('purpose')->nullable();
            $table->dateTime('preferred_start')->nullable();
            $table->unsignedSmallInteger('duration_minutes')->default(60);
            $table->string('status', 20)->default('pending');
            $table->text('review_comment')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
            $table->index(['requester_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_approval_requests');
    }
};
