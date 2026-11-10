<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingTask extends Model
{
    protected $fillable = [
        'meeting_id',
        'title',
        'assignee_id',
        'assignee_ids',
        'deadline',
        'status',
    ];

    protected $casts = [
        'deadline' => 'date',
        'assignee_ids' => 'array',
    ];

    /**
     * Встреча, в рамках которой поставлена задача
     */
    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Ответственный за задачу (основной, обратная совместимость)
     */
    public function assignee()
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * Все ответственные (множественное назначение)
     */
    public function assignees()
    {
        return $this->belongsToMany(User::class, 'meeting_task_assignees', 'meeting_task_id', 'user_id');
    }

    /**
     * Комментарии к задаче
     */
    public function comments()
    {
        return $this->hasMany(TaskComment::class)->latest('created_at');
    }
}
