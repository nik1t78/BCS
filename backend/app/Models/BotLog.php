<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Дневник попыток создания/проверки ссылок ВКС через Selenium-бота.
 * Пишется из CreateVksLinkJob и vks:autopilot; читается из
 * AdminBotLogController (страница /admin/bot-log и SLA-метрики).
 */
class BotLog extends Model
{
    protected $fillable = [
        'meeting_id',
        'action',
        'trigger',
        'success',
        'link',
        'error',
        'duration_ms',
    ];

    protected $casts = [
        'success' => 'boolean',
    ];

    public function meeting()
    {
        return $this->belongsTo(Meeting::class, 'meeting_id');
    }
}
