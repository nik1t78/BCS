<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Журнал посещаемости экранов ТВ (см. миграцию tv_view_logs).
 * Пишется «скользко» из TvScreenController::next() — не чаще одного
 * UPDATE в минуту на экран, чтобы поллинг каждые 10 с не раздувал строку.
 */
class TvViewLog extends Model
{
    protected $fillable = [
        'room_id',
        'screen_id',
        'token_hash',
        'ip',
        'ua',
        'first_seen_at',
        'last_seen_at',
        'polls',
    ];

    protected $casts = [
        'first_seen_at' => 'datetime',
        'last_seen_at'  => 'datetime',
        'polls'         => 'integer',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class);
    }
}
