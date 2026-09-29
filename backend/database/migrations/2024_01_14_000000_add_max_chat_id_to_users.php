<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Привязка аккаунта мессенджера MAX (VK Teams/max.ru) к пользователю
     * для отправки уведомлений о встречах.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'max_chat_id')) {
                $table->string('max_chat_id', 100)->nullable()->after('phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('max_chat_id');
        });
    }
};
