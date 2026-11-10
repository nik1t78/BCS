<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MeetingTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'duration_minutes',
        'room',
        'link',
        'priority',
        'reminder_minutes',
        'recurring',
        'is_private',
        'default_participants',
    ];

    protected $casts = [
        'is_private' => 'boolean',
        'default_participants' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
