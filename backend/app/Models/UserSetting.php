<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'sound_enabled',
        'browser_notifications',
        'default_reminder_minutes',
        'work_hours_start',
        'work_hours_end',
        'timezone',
    ];

    protected $casts = [
        'sound_enabled' => 'boolean',
        'browser_notifications' => 'boolean',
        'default_reminder_minutes' => 'integer',
    ];

    /**
     * Пользователь настроек
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
