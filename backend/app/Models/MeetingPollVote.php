<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetingPollVote extends Model
{
    protected $fillable = ['poll_id', 'user_id', 'option_index'];

    protected $casts = [
        'poll_id' => 'integer',
        'user_id' => 'integer',
        'option_index' => 'integer',
    ];

    public function poll(): BelongsTo
    {
        return $this->belongsTo(MeetingPoll::class, 'poll_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
