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
            // Полное удаление Telegram из проекта: колонки telegram_* больше не используются.
            foreach (['telegram_chat_id', 'telegram_link_code'] as $tgCol) {
                if (Schema::hasColumn('users', $tgCol)) {
                    $table->dropColumn($tgCol);
                }
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
