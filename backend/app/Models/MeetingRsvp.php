<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingRsvp extends Model
{
    public const RESPONSES = ['yes', 'no', 'maybe'];

    protected $fillable = ['meeting_id', 'user_id', 'response', 'responded_at'];

    protected $casts = [
        'responded_at' => 'datetime',
    ];

    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
