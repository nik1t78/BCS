<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'meeting_id',
        'message',
        'type',
        'read',
    ];

    protected $casts = [
        'read' => 'boolean',
    ];

    /**
     * Пользователь уведомления
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Связанная конференция
     */
    public function meeting()
    {
        return $this->belongsTo(Meeting::class);
    }

    /**
     * Scope: непрочитанные
     */
    public function scopeUnread($query)
    {
        return $query->where('read', false);
    }

    /**
     * Scope: по пользователю
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Отметить как прочитанное
     */
    public function markAsRead(): self
    {
        $this->update(['read' => true]);
        return $this;
    }

    /**
     * Получить иконку типа
     */
    public function getTypeIconAttribute(): string
    {
        return match($this->type) {
            'reminder' => 'fa-bell',
            'starting' => 'fa-video',
            'info' => 'fa-info-circle',
            'warning' => 'fa-exclamation-triangle',
            'user-added' => 'fa-user-plus',
            default => 'fa-bell',
        };
    }

    /**
     * Получить цвет типа
     */
    public function getTypeColorAttribute(): string
    {
        return match($this->type) {
            'reminder' => 'yellow',
            'starting' => 'blue',
            'info' => 'green',
            'warning' => 'red',
            'user-added' => 'purple',
            default => 'gray',
        };
    }
}
