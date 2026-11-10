<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('meetings', 'vks_link_status')) {
            Schema::table('meetings', function (Blueprint $table) {
                $table->string('vks_link_status', 24)->default('not_required')->after('link')->index();
            });
        }

        DB::table('meetings')->whereNotNull('link')->where('link', '<>', '')
            ->update(['vks_link_status' => 'created']);
    }

    public function down(): void
    {
        if (Schema::hasColumn('meetings', 'vks_link_status')) {
            Schema::table('meetings', function (Blueprint $table) {
                $table->dropIndex(['vks_link_status']);
                $table->dropColumn('vks_link_status');
            });
        }
    }
};
