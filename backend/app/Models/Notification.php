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
        'title',
        'message',
        'type',
        'read',
    ];

    protected $casts = [
        'read' => 'boolean',
    ];

    /**
     * После создания in-app уведомления — продублировать его в мессенджер
     * (MAX) получателя, если он привязан и интеграция включена.
     */
    protected static function booted(): void
    {
        static::created(function (Notification $notification) {
            // Realtime: мгновенная доставка в канал пользователя
            // (SSE /api/notifications/stream). Публикуем ДО дублирования в
            // мессенджер и вне зависимости от него — это лёгкая запись в Redis.
            try {
                app(\App\Services\RealtimeNotifier::class)->publish(
                    (int) $notification->user_id,
                    [
                        'id' => (string) $notification->id,
                        'message' => $notification->message,
                        'type' => $notification->type,
                        'meeting_id' => $notification->meeting_id !== null ? (string) $notification->meeting_id : null,
                        'timestamp' => optional($notification->created_at)->toIso8601String(),
                    ]
                );
            } catch (\Throwable $e) {
                // нет Redis / не тот драйвер очереди — молча продолжаем (поллинг работает)
            }

            try {
                if (\App\Services\MessengerNotifier::isEnabled()) {
                    $user = $notification->user()->first();
                    if ($user) {
                        \App\Services\MessengerNotifier::notifyMeeting($user, $notification);
                    }
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Messenger delivery failed: ' . $e->getMessage());
            }
        });
    }

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
