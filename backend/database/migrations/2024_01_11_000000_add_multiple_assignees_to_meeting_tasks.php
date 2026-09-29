<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meeting_tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('meeting_tasks', 'assignee_ids')) {
                $table->json('assignee_ids')->nullable()->after('assignee_id');
            }
        });

        // Подхватить уже существующих одиночных ответственных в массив
        \App\Models\MeetingTask::query()
            ->whereNotNull('assignee_id')
            ->whereNull('assignee_ids')
            ->chunkById(200, function ($tasks) {
                foreach ($tasks as $task) {
                    $task->assignee_ids = [$task->assignee_id];
                    $task->saveQuietly();
                }
            });
    }

    public function down(): void
    {
        Schema::table('meeting_tasks', function (Blueprint $table) {
            $table->dropColumn('assignee_ids');
        });
    }
};
