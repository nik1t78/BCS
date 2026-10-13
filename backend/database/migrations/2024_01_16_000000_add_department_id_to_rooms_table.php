<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RBAC комнат по подразделениям: room привязывается к отделу (или остаётся
 * публичной при department_id = null). Правила бронирования проверяются в
 * MeetingController::validateRoomAccess.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->unsignedBigInteger('department_id')->nullable()->after('location')->index();
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn('department_id');
        });
    }
};
