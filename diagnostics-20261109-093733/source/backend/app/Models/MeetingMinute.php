<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingMinute extends Model
{
    protected $fillable = [
        'meeting_id',
        'user_id',
        'discussion',
        'decisions',
        'responsible',
    ];

    /**
     * Встреча, к которой относится запись протокола
     */
    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Автор записи
     */
    public function author()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
