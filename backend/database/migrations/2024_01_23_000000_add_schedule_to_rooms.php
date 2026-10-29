<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Гибкий график залов: рабочие часы по дням недели + нерабочие дни (праздники).
 * До появления этой колонки рабочий день был жёстко зашит 00:00–20:00 —
 * источник жалоб «зал свободен, но в Свободные залы не показан / нельзя забронировать».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            // Формат: {"days":{"mon":{"start":"08:00","end":"20:00"},...},"closed":["2026-11-04",...]}
            // null = используется график по умолчанию (08:00–20:00, сб/вс закрыто).
            $table->json('schedule')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('schedule');
        });
    }
};
