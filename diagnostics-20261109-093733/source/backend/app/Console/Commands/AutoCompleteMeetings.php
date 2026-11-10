<?php

namespace App\Console\Commands;

use App\Models\Meeting;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class AutoCompleteMeetings extends Command
{
    protected $signature = 'meetings:auto-complete';
    protected $description = 'Автозавершение прошедших конференций (scheduled/in-progress -> completed)';

    public function handle(): int
    {
        $now = Carbon::now();
        $today = $now->toDateString();
        $todayImmutable = CarbonImmutable::parse($today);

        // 1) Разовые встречи в прошлом: date < сегодня, либо сегодня и время
        // окончания (или начала, если окончания нет) уже наступило.
        $endOrStart = "TIMESTAMP(date, COALESCE(end_time, start_time, '23:59:00'))";
        $nowTs = $now->format('Y-m-d H:i:s');
        $pastQuery = Meeting::query()
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->where(function ($q) use ($today, $nowTs, $endOrStart) {
                $q->whereDate('date', '<', $today)
                  ->orWhere(function ($r) use ($today, $nowTs, $endOrStart) {
                      $r->whereDate('date', '=', $today)
                        ->whereRaw("{$endOrStart} <= ?", [$nowTs]);
                  });
            })
            // Повторяющиеся серии обрабатываются отдельно (см. п.2): их нельзя
            // завершать «навсегда» только потому, что первая дата уже прошла.
            ->where(function ($q) {
                $q->where('recurring', 'none')->orWhereNull('recurring');
            });

        $single = $pastQuery->update(['status' => 'completed']);

        // 2) Повторяющиеся серии: завершаем occurrence'ом — встреча становится
        // completed, только если последний повтор уже прошёл (repeat_until задан
        // и закончился). Иначе серия остаётся активной: RecurrenceService::occursOn
        // скажет, был ли повтор сегодня/вчера. Серии без repeat_until считаются
        // бесконечными и не автозавершаются (их отменяет/завершает организатор).
        $series = Meeting::query()
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->where('recurring', '!=', 'none')
            ->whereNotNull('recurring')
            ->whereNotNull('repeat_until')
            ->get();

        $recurringCompleted = 0;
        foreach ($series as $m) {
            if (!$this->isSeriesOver($m, $todayImmutable, $now)) {
                continue;
            }
            $m->status = 'completed';
            $m->save();
            $recurringCompleted++;
        }

        $this->info("Автозавершено встреч: разовых — {$single}, серий — {$recurringCompleted}.");

        return self::SUCCESS;
    }

    /**
     * Серия считается завершённой, если её последний повтор точно прошёл:
     * дата repeat_until раньше сегодня, либо равна сегодня, но время окончания уже наступило.
     */
    private function isSeriesOver(Meeting $m, CarbonImmutable $today, Carbon $now): bool
    {
        $until = CarbonImmutable::parse($m->repeat_until);
        if ($until->lt($today)) {
            return true;
        }
        if ($until->eq($today)) {
            $endTime = Carbon::parse($today . ' ' . $m->end_time);
            return $endTime->lte($now);
        }
        return false; // серия ещё идёт в будущем
    }
}
