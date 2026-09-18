<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Meeting;
use App\Models\Notification;
use App\Models\User;
use Carbon\Carbon;

class SendMeetingNotifications extends Command
{
    protected $signature = 'meetings:send-notifications';
    protected $description = 'Отправка уведомлений о предстоящих конференциях';

    public function handle()
    {
        $this->info('Начало проверки уведомлений...');

        $now = Carbon::now();
        $meetings = Meeting::where('date', $now->toDateString())
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->get();

        $notificationsSent = 0;

        foreach ($meetings as $meeting) {
            // Проверка начала конференции
            $startTime = Carbon::parse($meeting->date . ' ' . $meeting->start_time);
            
            if ($now->between($startTime->copy()->subMinutes(5), $startTime->copy()->addMinutes(5))) {
                // Уведомление о начале конференции
                foreach ($meeting->participants as $participantId) {
                    $exists = Notification::where('user_id', $participantId)
                        ->where('meeting_id', $meeting->id)
                        ->where('type', 'starting')
                        ->whereDate('created_at', $now->toDateString())
                        ->exists();

                    if (!$exists) {
                        Notification::create([
                            'user_id' => $participantId,
                            'meeting_id' => $meeting->id,
                            'message' => "🔴 Конференция \"{$meeting->title}\" начинается сейчас!",
                            'type' => 'starting',
                            'read' => false,
                        ]);
                        $notificationsSent++;
                    }
                }
            }

            // Проверка напоминаний
            $reminderTime = $startTime->copy()->subMinutes($meeting->reminder_minutes);
            
            if ($now->between($reminderTime->copy()->subMinutes(1), $reminderTime->copy()->addMinutes(1))) {
                // Уведомление-напоминание
                foreach ($meeting->participants as $participantId) {
                    $exists = Notification::where('user_id', $participantId)
                        ->where('meeting_id', $meeting->id)
                        ->where('type', 'reminder')
                        ->whereDate('created_at', $now->toDateString())
                        ->exists();

                    if (!$exists) {
                        Notification::create([
                            'user_id' => $participantId,
                            'meeting_id' => $meeting->id,
                            'message' => "⏰ Напоминание: через {$meeting->reminder_minutes} мин. начнётся \"{$meeting->title}\"",
                            'type' => 'reminder',
                            'read' => false,
                        ]);
                        $notificationsSent++;
                    }
                }
            }
        }

        $this->info("Отправлено {$notificationsSent} уведомлений.");
        
        return 0;
    }
}
