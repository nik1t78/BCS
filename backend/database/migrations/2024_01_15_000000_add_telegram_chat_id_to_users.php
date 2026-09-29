<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'telegram_chat_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('telegram_chat_id', 100)->nullable()->after('phone');
                $table->string('telegram_link_code', 32)->nullable()->unique()->after('telegram_chat_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'telegram_chat_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique(['telegram_link_code']);
                $table->dropColumn(['telegram_chat_id', 'telegram_link_code']);
            });
        }
    }
};
