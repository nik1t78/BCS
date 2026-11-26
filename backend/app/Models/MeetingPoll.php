<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MeetingPoll extends Model
{
    protected $fillable = ['meeting_id', 'created_by', 'question', 'options', 'closed_at'];

    protected $casts = [
        'options' => 'array',
        'closed_at' => 'datetime',
    ];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(MeetingPollVote::class, 'poll_id');
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }
}
