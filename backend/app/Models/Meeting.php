<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

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
     * Уведомления связанные с конференцией
     */
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Теги конференции
     */
    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'meeting_tag');
    }

    /**
     * Вложения конференции
     */
    public function attachments()
    {
        return $this->hasMany(Attachment::class);
    }

    /**
     * История изменений конференции
     */
    public function history()
    {
        return $this->hasMany(MeetingHistory::class);
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
    public function isStartingAt($time): bool
    {
        return $this->date->isToday() && $this->start_time === $time;
    }

    /**
     * Проверка: нужно отправить напоминание
     */
    public function needsReminderAt($time): bool
    {
        if (!$this->date->isToday()) return false;
        
        $reminderTime = Carbon::parse($this->date->toDateString() . ' ' . $this->start_time)
            ->subMinutes($this->reminder_minutes);
        
        return $reminderTime->format('H:i') === $time;
    }

    /**
     * Получить цвет приоритета
     */
    public function getPriorityColorAttribute(): string
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
    public function getStatusTextAttribute(): string
    {
        return match($this->status) {
            'scheduled' => 'Запланирована',
            'in-progress' => 'Идёт',
            'completed' => 'Завершена',
            'cancelled' => 'Отменена',
            default => 'Неизвестно',
        };
    }

    /**
     * Проверка: пользователь является участником
     */
    public function isParticipant($userId): bool
    {
        return in_array($userId, $this->participants ?? []);
    }

    /**
     * Проверка: пользователь является организатором
     */
    public function isOrganizer($userId): bool
    {
        return $this->organizer_id === $userId;
    }

    /**
     * Проверка: пользователь имеет доступ
     */
    public function hasAccess($user): bool
    {
        if (!$this->is_private) return true;
        return $this->isOrganizer($user->id) || $this->isParticipant($user->id) || $user->isAdmin();
    }

    /**
     * Scope: доступные пользователю
     */
    public function scopeAccessibleBy($query, $user)
    {
        if ($user->isAdmin()) return $query;
        
        return $query->where(function($q) use ($user) {
            $q->where('is_private', false)
              ->orWhere('organizer_id', $user->id)
              ->orWhereJsonContains('participants', $user->id);
        });
    }
}
