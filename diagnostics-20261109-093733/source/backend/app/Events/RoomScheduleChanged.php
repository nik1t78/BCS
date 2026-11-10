<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Event;

/**
 * Событие изменения расписания зала — мгновенно обновляет экраны ТВ (Reverb).
 * Вещается в публичный канал vks-public.room.{id}: содержимое — только сам факт
 * изменения (без данных), поэтому авторизация не требуется; данные экран всегда
 * добирает через проверенный поллинг /api/tv/{id}/next.
 */
class RoomScheduleChanged implements ShouldBroadcastNow
{
    public function __construct(public int $roomId)
    {
    }

    public function broadcastOn(): array
    {
        return [new Channel('vks-public.room.' . $this->roomId)];
    }

    public function broadcastAs(): string
    {
        return 'schedule.changed';
    }
}
