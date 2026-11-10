<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meeting_task_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('meeting_task_id')->constrained('meeting_tasks')->cascadeDelete();
            $table->foreignId('user_id')->constrained()->cascadeDelete();
            $table->unique(['meeting_task_id', 'user_id']);
        });

        // Синхронизация с существующими assignee_id
        \App\Models\MeetingTask::query()
            ->whereNotNull('assignee_id')
            ->chunkById(200, function ($tasks) {
                foreach ($tasks as $task) {
                    \DB::table('meeting_task_assignees')->insertOrIgnore([
                        'meeting_task_id' => $task->id,
                        'user_id' => $task->assignee_id,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('meeting_task_assignees');
    }
};
