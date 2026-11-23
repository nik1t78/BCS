<?php

namespace App\\Console\\Commands;

use App\\Models\\Meeting;
use App\\Models\\MeetingRsvp;
use App\\Models\\Notification;
use App\\Models\\User;
use App\\Services\\RecurrenceService;
use App\\Support\\RsvpReminderPolicy;
use Carbon\\Carbon;
use Carbon\\CarbonImmutable;
use Illuminate\\Console\\Command;

class SendRsvpReminders extends Command
{
    protected $signature = 'meetings:send-rsvp-reminders';
    protected $description = 'Напоминания участникам, не подтвердившим присутствие';

    public function handle(): int
    {
        $offsets = RsvpReminderPolicy::parseOffsets((string) config('vks.rsvp_reminder_minutes', '1440,60'));
        if ($offsets === []) {
            $this->info('RSVP-напоминания отключены: список интервалов пуст.');
            return self::SUCCESS;
        }

        $now = Carbon::now();
        $from = CarbonImmutable::today();
        $maxDays = (int) ceil(max($offsets) / 1440) + 1;
        $to = $from->addDays($maxDays);

        // Берём базовые записи серий в пределах поддерживаемого горизонта
        // и разворачиваем реальные даты повторений через общий RecurrenceService.
        $meetings = Meeting::query()
            ->whereDate('date', '>=', $from->subDays(RecurrenceService::HORIZON_DAYS)->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->get();

        $occurrences = RecurrenceService::expand($meetings, $from, $to);
        $sent = 0;

        foreach ($occurrences as $occurrence) {
            /** @var Meeting $meeting */
            $meeting = $occurrence['meeting'];
            $startAt = Carbon::parse($occurrence['date'] . ' ' . $meeting->start_time);
            $secondsUntilStart = $now->diffInSeconds($startAt, false);

            foreach ($offsets as $offset) {
                if (!RsvpReminderPolicy::isDue($secondsUntilStart, $offset)) {
                    continue;
                }

                $sent += $this->notifyPendingParticipants($meeting, $occurrence['date'], $startAt, $offset);
            }
        }

        $this->info("Отправлено RSVP-напоминаний: {$sent}.");
        return self::SUCCESS;
    }

    private function notifyPendingParticipants(Meeting $meeting, string $occurrenceDate, Carbon $startAt, int $offset): int
    {
        $participantIds = array_values(array_unique(array_filter(
            array_map('intval', $meeting->participants ?? []),
            fn (int $id) => $id > 0 && $id !== (int) $meeting->organizer_id
        )));

        if ($participantIds === []) {
            return 0;
        }

        $responses = MeetingRsvp::query()
            ->where('meeting_id', $meeting->id)
            ->whereIn('user_id', $participantIds)
            ->pluck('response', 'user_id');

        $pendingIds = array_values(array_filter(
            $participantIds,
            fn (int $id) => RsvpReminderPolicy::needsResponse($responses->get($id))
        ));

        if ($pendingIds === []) {
            return 0;
        }

        $users = User::query()->active()->whereIn('id', $pendingIds)->get(['id', 'name']);
        $sent = 0;
        $dateLabel = $startAt->format('d.m.Y');
        $timeLabel = $startAt->format('H:i');

        foreach ($users as $user) {
            $prefix = $responses->get($user->id) === 'maybe'
                ? 'Вы отметили, что пока не определились. Уточните, пожалуйста, участие'
                : 'Пожалуйста, подтвердите участие';

            $message = "🔔 {$prefix} в конференции «{$meeting->title}» ({$dateLabel} в {$timeLabel}). Напоминание за {$offset} мин.";

            // Дата occurrence и текст сообщения участвуют в ключе дедупликации:
            // один участник получает не более одного одинакового напоминания
            // для каждой даты серии и каждого настроенного интервала.
            $exists = Notification::query()
                ->where('user_id', $user->id)
                ->where('meeting_id', $meeting->id)
                ->where('type', 'rsvp_reminder')
                ->where('message', $message)
                ->exists();

            if ($exists) {
                continue;
            }

            Notification::create([
                'user_id' => $user->id,
                'meeting_id' => $meeting->id,
                'message' => $message,
                'type' => 'rsvp_reminder',
                'read' => false,
            ]);
            $sent++;
        }

        return $sent;
    }
}
