<?php

namespace App\Console\Commands;

use App\Models\Meeting;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;
use Carbon\Carbon;

class SendMeetingReminders extends Command
{
    protected $signature = 'meetings:send-reminders';
    protected $description = 'Отправка напоминаний о предстоящих конференциях';

    public function handle()
    {
        $this->info('Проверка напоминаний о конференциях...');

        $now = Carbon::now();
        $today = $now->toDateString();
        // Формат H:i — start_time хранится как TIME и Laravel возвращает строку 'H:i:s',
        // поэтому сравнение выполняется через Carbon (см. Meeting::isStartingAt / needsReminderAt)
        $currentTime = $now->format('H:i');

        $meetings = Meeting::where('date', $today)
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->get();

        $count = 0;

        foreach ($meetings as $meeting) {
            // Проверка: конференция начинается сейчас
            if ($meeting->start_time === $currentTime) {
                $count += $this->sendStartingNotification($meeting);
            }

            // Проверка: нужно отправить напоминание
            if ($meeting->needsReminderAt($currentTime)) {
                $count += $this->sendReminderNotification($meeting);
            }
        }

        $this->info("Отправлено {$count} уведомлений.");
    }

    private function sendStartingNotification(Meeting $meeting): int
    {
        $participantIds = $meeting->participants ?? [];
        $participantIds[] = $meeting->organizer_id;
        $count = 0;

        foreach (array_unique($participantIds) as $userId) {
            $exists = Notification::where('user_id', $userId)
                ->where('meeting_id', $meeting->id)
                ->where('type', 'starting')
                ->whereDate('created_at', today())
                ->exists();

            if (!$exists) {
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "🔴 Конференция \"{$meeting->title}\" начинается сейчас!",
                    'type' => 'starting',
                    'read' => false,
                ]);
                $count++;
            }
        }

        return $count;
    }

    private function sendReminderNotification(Meeting $meeting): int
    {
        $participantIds = $meeting->participants ?? [];
        $participantIds[] = $meeting->organizer_id;
        $count = 0;

        foreach (array_unique($participantIds) as $userId) {
            $exists = Notification::where('user_id', $userId)
                ->where('meeting_id', $meeting->id)
                ->where('type', 'reminder')
                ->whereDate('created_at', today())
                ->exists();

            if (!$exists) {
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "⏰ Напоминание: через {$meeting->reminder_minutes} мин. — \"{$meeting->title}\"",
                    'type' => 'reminder',
                    'read' => false,
                ]);
                $count++;
            }
        }

        return $count;
    }
}
