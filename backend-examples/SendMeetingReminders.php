<?php

namespace App\Console\Commands;

use App\Models\Meeting;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Console\Command;

class SendMeetingReminders extends Command
{
    protected $signature = 'meetings:send-reminders';
    protected $description = 'Отправка напоминаний о предстоящих конференциях';

    public function handle()
    {
        $this->info('Проверка напоминаний о конференциях...');

        $now = now();
        $today = $now->toDateString();
        $currentTime = $now->format('H:i');

        // Получаем все конференции на сегодня
        $meetings = Meeting::where('date', $today)
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->get();

        foreach ($meetings as $meeting) {
            // Проверка: конференция начинается сейчас
            if ($meeting->start_time === $currentTime) {
                $this->sendStartingNotification($meeting);
            }

            // Проверка: нужно отправить напоминание
            if ($meeting->needsReminderAt($currentTime)) {
                $this->sendReminderNotification($meeting);
            }
        }

        $this->info('Проверка завершена.');
    }

    /**
     * Отправка уведомления о начале конференции
     */
    private function sendStartingNotification(Meeting $meeting)
    {
        // Получаем всех участников
        $participantIds = $meeting->participants ?? [];
        $participantIds[] = $meeting->organizer_id;

        foreach (array_unique($participantIds) as $userId) {
            // Проверяем, не отправляли ли уже уведомление
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

                // Отправка email уведомления
                $user = User::find($userId);
                if ($user) {
                    // Mail::to($user->email)->queue(new MeetingStartingMail($meeting));
                    $this->info("Отправлено уведомление о начале для пользователя {$user->email}");
                }
            }
        }
    }

    /**
     * Отправка напоминания о конференции
     */
    private function sendReminderNotification(Meeting $meeting)
    {
        $participantIds = $meeting->participants ?? [];
        $participantIds[] = $meeting->organizer_id;

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

                $user = User::find($userId);
                if ($user) {
                    // Mail::to($user->email)->queue(new MeetingReminderMail($meeting));
                    $this->info("Отправлено напоминание для пользователя {$user->email}");
                }
            }
        }
    }
}
