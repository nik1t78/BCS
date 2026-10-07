<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskComment extends Model
{
    protected $fillable = [
        'meeting_task_id',
        'user_id',
        'body',
    ];

    public function task()
    {
        return $this->belongsTo(MeetingTask::class, 'meeting_task_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
