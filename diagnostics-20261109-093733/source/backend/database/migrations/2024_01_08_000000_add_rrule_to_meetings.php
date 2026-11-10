<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Сложные правила повторов (RRULE): расширяем enum recurring значением 'custom'
 * и добавляем строку rrule с упрощённым RRULE (RFC 5545 subset).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->string('rrule', 255)->nullable()->after('repeat_until');
        });

        // MySQL не поддерживает ALTER ENUM напрямую через Blueprint — меняем через DB.
        DB::statement("ALTER TABLE meetings CHANGE recurring recurring ENUM('none','daily','weekly','monthly','custom') NOT NULL DEFAULT 'none'");
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('rrule');
        });
        DB::statement("UPDATE meetings SET recurring = 'monthly' WHERE recurring = 'custom'");
        DB::statement("ALTER TABLE meetings CHANGE recurring recurring ENUM('none','daily','weekly','monthly') NOT NULL DEFAULT 'none'");
    }
};
