<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Meeting extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'date',
        'start_time',
        'end_time',
        'organizer_id',
        'participants',
        'participant_emails',
        'link',
        'room',
        'status',
        'reminder_minutes',
        'recurring',
        'priority',
        'is_private',
    ];

    protected $casts = [
        'date' => 'date',
        'participants' => 'array',
        'participant_emails' => 'array',
        'is_private' => 'boolean',
        'reminder_minutes' => 'integer',
    ];

    /**
     * Организатор конференции
     */
    public function organizer()
    {
        return $this->belongsTo(User::class, 'organizer_id');
    }

    /**
     * Участники (пользователи системы)
     */
    public function participants()
    {
        return $this->belongsToMany(User::class, 'meeting_user', 'meeting_id', 'user_id');
    }

    /**
     * Уведомления связанные с конференцией
     */
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Scope: только предстоящие
     */
    public function scopeUpcoming($query)
    {
        return $query->where('date', '>=', now()->toDateString())
                     ->whereIn('status', ['scheduled', 'in-progress']);
    }

    /**
     * Scope: только мои
     */
    public function scopeMyMeetings($query, $userId)
    {
        return $query->where(function($q) use ($userId) {
            $q->where('organizer_id', $userId)
              ->orWhereJsonContains('participants', $userId);
        });
    }

    /**
     * Проверка: конференция начинается в указанное время
     */
    public function isStartingAt($time)
    {
        return $this->date->isToday() && $this->start_time === $time;
    }

    /**
     * Проверка: нужно отправить напоминание
     */
    public function needsReminderAt($time)
    {
        if (!$this->date->isToday()) return false;
        
        $reminderTime = \Carbon\Carbon::parse($this->date->toDateString() . ' ' . $this->start_time)
            ->subMinutes($this->reminder_minutes);
        
        return $reminderTime->format('H:i') === $time;
    }

    /**
     * Получить цвет приоритета
     */
    public function getPriorityColorAttribute()
    {
        return match($this->priority) {
            'high' => 'red',
            'medium' => 'yellow',
            'low' => 'green',
            default => 'gray',
        };
    }

    /**
     * Получить текст статуса
     */
    public function getStatusTextAttribute()
    {
        return match($this->status) {
            'scheduled' => 'Запланирована',
            'in-progress' => 'Идёт',
            'completed' => 'Завершена',
            'cancelled' => 'Отменена',
            default => 'Неизвестно',
        };
    }
}
