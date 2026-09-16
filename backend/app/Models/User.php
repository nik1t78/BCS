<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'department',
        'position',
        'avatar',
        'is_active',
        'last_login',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login' => 'datetime',
        'password' => 'hashed',
        'is_active' => 'boolean',
    ];

    /**
     * Проверка роли администратора
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Проверка роли модератора
     */
    public function isModerator(): bool
    {
        return $this->role === 'moderator';
    }

    /**
     * Проверка роли обычного пользователя
     */
    public function isUser(): bool
    {
        return $this->role === 'user';
    }

    /**
     * Проверка админ или модератор
     */
    public function isAdminOrModerator(): bool
    {
        return in_array($this->role, ['admin', 'moderator']);
    }

    /**
     * Конференции, организованные пользователем
     */
    public function organizedMeetings()
    {
        return $this->hasMany(Meeting::class, 'organizer_id');
    }

    /**
     * Уведомления пользователя
     */
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Непрочитанные уведомления
     */
    public function unreadNotifications()
    {
        return $this->hasMany(Notification::class)->where('read', false);
    }

    /**
     * Настройки пользователя
     */
    public function settings()
    {
        return $this->hasOne(UserSetting::class);
    }

    /**
     * Получить настройки или создать дефолтные
     */
    public function getSettings(): UserSetting
    {
        return $this->settings ?? UserSetting::create([
            'user_id' => $this->id,
        ]);
    }

    /**
     * Scope: только активные пользователи
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: по роли
     */
    public function scopeRole($query, $role)
    {
        return $query->where('role', $role);
    }

    /**
     * Получить полное имя с должностью
     */
    public function getFullInfoAttribute(): string
    {
        $info = $this->name;
        if ($this->position) {
            $info .= " ({$this->position})";
        }
        return $info;
    }
}
