<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MeetingApprovalRequest extends Model
{
    protected $fillable = [
        'meeting_id', 'requester_id', 'reviewer_id', 'title', 'purpose',
        'preferred_start', 'duration_minutes', 'status', 'review_comment',
    ];

    protected $casts = ['preferred_start' => 'datetime'];

    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
    public function reviewer() { return $this->belongsTo(User::class, 'reviewer_id'); }
    public function meeting() { return $this->belongsTo(Meeting::class); }
}
