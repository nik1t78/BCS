<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = [
        'name',
        'capacity',
        'location',
        'department_id',
        'equipment',
        'description',
        'is_active',
        'tv_token',
    ];

    protected $casts = [
        'equipment' => 'array',
        'is_active' => 'boolean',
        'department_id' => 'integer',
    ];

    /**
     * Скрыть токен экрана по умолчанию: он попадает в ответ /rooms только
     * администраторам (см. RoomController::index) и нужен лишь для URL телевизора.
     */
    protected $hidden = ['tv_token'];
}
