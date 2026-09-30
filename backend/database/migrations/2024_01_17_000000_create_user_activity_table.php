<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_activity', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('action', 191); // method:path, напр. post:api/meetings
            $table->timestamp('created_at')->nullable()->index();
        });

        Schema::create('daily_stats', function (Blueprint $table) {
            $table->date('date')->primary();
            $table->unsignedInteger('dau')->default(0);
            $table->unsignedInteger('mau')->default(0);
            $table->unsignedInteger('actions')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_stats');
        Schema::dropIfExists('user_activity');
    }
};
