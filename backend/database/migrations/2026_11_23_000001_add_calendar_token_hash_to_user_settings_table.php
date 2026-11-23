<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('user_settings') || Schema::hasColumn('user_settings', 'calendar_token_hash')) {
            return;
        }

        Schema::table('user_settings', function (Blueprint $table) {
            // Храним только SHA-256 от случайного токена подписки, сам секрет не сохраняем.
            $table->string('calendar_token_hash', 64)->nullable()->unique();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('user_settings') && Schema::hasColumn('user_settings', 'calendar_token_hash')) {
            Schema::table('user_settings', function (Blueprint $table) {
                $table->dropUnique(['calendar_token_hash']);
                $table->dropColumn('calendar_token_hash');
            });
        }
    }
};
