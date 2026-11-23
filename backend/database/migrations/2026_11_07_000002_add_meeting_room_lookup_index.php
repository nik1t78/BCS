<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ускоряет проверку занятости конкретного зала и выборки расписания.
        // Индекс не запрещает одинаковое время в разных залах: это не UNIQUE.
        Schema::table('meetings', function (Blueprint $table) {
            $table->index(['room', 'date', 'status'], 'meetings_room_date_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropIndex('meetings_room_date_status_idx');
        });
    }
};
