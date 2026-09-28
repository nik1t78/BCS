<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingTask extends Model
{
    protected $fillable = [
        'meeting_id',
        'title',
        'assignee_id',
        'deadline',
        'status',
    ];

    protected $casts = [
        'deadline' => 'date',
    ];

    /**
     * Встреча, в рамках которой поставлена задача
     */
    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Ответственный за задачу
     */
    public function assignee()
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }
}
