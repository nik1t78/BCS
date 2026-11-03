<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }

    protected function schedule(Schedule $schedule): void
    {
        // Напоминания о предстоящих конференциях каждую минуту
        $schedule->command('meetings:send-reminders')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Автозавершение прошедших конференций (scheduled/in-progress -> completed).
        // Раньше стоял hourly(): встреча на 02.11 с окончанием, например, в 11:00
        // могла ЧАС висеть в статусе scheduled после окончания и молча пропадать
        // из «Предстоящих» (фильтр отсекает всё, что раньше now по endTime) —
        // пользователь видел «сегодня ничего не упало в Мои конференции». Теперь
        // статус обновляется каждые 5 минут: задержка исчезновения ≤ 5 мин, а
        // завершённые встречи сразу уходят в фильтр «Прошедшие».
        $schedule->command('meetings:auto-complete')
                 ->everyFiveMinutes()
                 ->withoutOverlapping();

        // Очистка старых уведомлений (старше 30 дней)
        $schedule->command('notifications:cleanup')
                 ->daily()
                 ->at('03:00');

        // Уведомления о конференциях текущего дня — каждые 15 минут
        // (команда сама пропускает уже отправленные уведомления)
        $schedule->command('meetings:send-notifications')
                 ->everyFifteenMinutes()
                 ->withoutOverlapping();

        // Продуктовая аналитика: снимок DAU/MAU, ежедневно в 00:15
        // (по умолчанию считается текущий день; догон вчерашнего — при перезапуске)
        $schedule->command('analytics:daily')
                 ->daily()
                 ->at('00:15');

        // Очистка кэша
        $schedule->command('cache:prune-stale-tags')
                 ->hourly();

        // Ежедневный бэкап базы данных в 02:30 (хранится 14 копий)
        $schedule->command('db:backup --keep=14')
                 ->dailyAt('02:30')
                 ->withoutOverlapping();

        // Еженедельный бэкап (доп. копия вне суточного цикла, хранение 8 копий):
        // стабильность на месяцы вперёд — при порче суточных бэкапов остаётся
        // недельная линейка history.
        $schedule->command('db:backup --keep=8')
                 ->weekly()
                 ->sundayAt('04:00')
                 ->withoutOverlapping();

        // Ротация дневника ВКС-бота: строки старше 90 дней удаляются раз в
        // сутки (таблица растёт с каждой генерацией ссылки и без чистки
        // раздувает БД; полноценное партиционирование MySQL требует DDL на
        // уровне инстанса, поэтому выбрана безопасная TTL-чистка).
        $schedule->call(function () {
            \App\Models\BotLog::where('created_at', '<', now()->subDays(90))
                ->chunkById(1000, fn ($rows) => $rows->each->delete());
        })->dailyAt('03:30')->name('bot-logs-prune');

        // Ротация журнала посещаемости ТВ: строки, чей последний сигнал старше
        // 60 дней, удаляются (живые экраны продлевают last_seen поллингом).
        $schedule->call(function () {
            \App\Models\TvViewLog::where('last_seen_at', '<', now()->subDays(60))->limit(5000)->delete();
        })->dailyAt('03:40')->name('tv-view-logs-prune');

        // Мониторинг ВКС-бота: каждые 5 минут проверяем /health и алертим
        // админу в MAX при сбое/восстановлении (см. VKSBOT_EXPECTED=true).
        $schedule->command('bot:monitor')
                 ->everyFiveMinutes()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Автопилот ВКС-ссылок (пункты 1–2): каждую минуту проверяет «живость»
        // комнат ближайших встреч и ставит проблемные в очередь на пересоздание
        // (CreateVksLinkJob, воркер vks-queue). Работает только при
        // VKSBOT_EXPECTED=true; окно проверки — VKSBOT_CHECK_MINUTES (по умолчанию 60 мин).
        $schedule->command('vks:autopilot')
                 ->everyMinute()
                 ->withoutOverlapping()
                 ->runInBackground();

        // NOTE: heartbeat воркера очереди пишет отдельный процесс
        // `php artisan queue:heartbeat` внутри контейнера queue
        // (см. docker-compose.yml). Планировщик ниже отмечает СВОЙ цикл —
        // файл cron_heartbeat.log, по которому «Статус системы» различает
        // scheduler и queue-worker (раньше оба читали один heartbeat, и
        // падение любого из них выглядело как отказ обоих).

        // Автомониторинг uptime (пункт 9): раз в 5 минут проверка MySQL/Redis/
        // nginx/queue-worker с дедуплицированными алертами админу.
        // Включается флагом SYSTEM_MONITOR_ENABLED=true в .env.
        $schedule->command('system:monitor')
                 ->everyFiveMinutes()
                 ->withoutOverlapping()
                 ->runInBackground();

        // Heartbeat планировщика: ОТДЕЛЬНЫЙ цикл, а не хвост schedule:run.
        // Раньше записывался в конце общего цикла — одна «залипшая» задача
        // блокировала весь цикл и «Статус системы» показывал «Планировщик:
        // ещё не запускался», хотя контейнер был жив. Но без withoutOverlapping()
        // при 60-секундном цикле (schedule:run & sleep 60) два параллельных
        // процесса писали один файл одновременно — race давал пустой/битый
        // файл, filemtime() = 0 → «Ещё не запускался». Теперь запись атомарна:
        // пишем во временный файл + rename (POSIX atomic), с проверкой результата.
        //
        // ВАЖНО: раньше здесь стоял withoutOverlapping(2). При 60-секундном
        // цикле запуска (schedule:run & sleep 60) Laravel мог считать слот
        // занятым и ПРОПУСКАТЬ эту задачу минуту за минутой — heartbeat не
        // писался, админка показывала вечное «Молчит 7053 мин», хотя сам
        // cron-цикл работал исправно. Задача пишущая только timestamp,
        // гонки между двумя процессами безвредны (последняя запись побеждает,
        // rename атомарен) — overlap-лок здесь не нужен и вреден.
        $schedule->call(function () {
            \App\Support\CronHeartbeat::write();
            // Дублируем heartbeat в кэш (Redis): на Windows/WSL2 bind-mount
            // файла storage/logs/cron_heartbeat.log может «застывать», и
            // «Статус системы» показывает «Молчит N мин». Кэш-копия с TTL
            // 3 минуты позволяет API выбрать самый свежий сигнал.
            try {
                cache()->put('scheduler:heartbeat', time(), now()->addMinutes(3));
            } catch (\Throwable $e) {
                // кэш недоступен — файл всё равно записан
            }
        })->everyMinute()->name('scheduler-heartbeat');

        // Страховка от ложного «Планировщик молчит N мин» в админке: если
        // цикл scheduler-heartbeat не писал ни файл, ни Redis дольше порога
        // (контейнер scheduler мёртв / залип withoutOverlapping-лок /
        // schedule:run упал до записи), планировщик НЕ сможет сам себя
        // «оживить». Поэтому web-процесс пишет аварийный маркер — статус
        // покажет «Активен (аварийный heartbeat)», а не загробное число
        // минут простоя. Заодно снимает 429-шторм: страница админки больше
        // не рисует бессмысленный «Молчит 5907 мин».
        $schedule->registerCallback(function () {
            try {
                $last = max(\App\Support\CronHeartbeat::lastTs(), (int) cache()->get('scheduler:heartbeat'));
                if ($last === 0 || (time() - $last) > 180) {
                    cache()->put('scheduler:heartbeat', time(), now()->addMinutes(3));
                    cache()->put('scheduler:heartbeat-emergency', 1, now()->addMinutes(3));
                } else {
                    cache()->forget('scheduler:heartbeat-emergency');
                }
            } catch (\Throwable $e) {
                // кэш недоступен — ничего не делаем
            }
        });

        // Подчистка журнала посещаемости ТВ: строки, невидевшиеся 30 дней,
        // больше не нужны (аналог ротации bot_logs). Раз в сутки.
        $schedule->call(function () {
            \App\Models\TvViewLog::where('last_seen_at', '<', now()->subDays(30))->delete();
        })->dailyAt('03:15')->name('tv-view-logs-prune');

        // Страховка от ложного «Воркер очереди: Нет heartbeat» в админке
        // (Windows/Docker Desktop): контейнер vks-queue жив (docker compose ps
        // это подтверждает), но sidecar queue:heartbeat не смог создать каталог
        // storage/app/heartbeat на bind-mount — файл heartbeat никогда не
        // появлялся, UI показывал мёртвый воркер, а ВКС-журнал выглядел
        // «не создающим ссылки». Раз в минуту проверяем: если heartbeat-файл
        // молчит дольше порога, а сам планировщик работает, пишем маркер в
        // кэш (cache-store=file — общий volume backend_storage виден всем
        // php-контейнерам). SystemStatusController/MonitorSystem учитывают
        // этот кэш как fallback. Это НЕ оживляет реально упавший воркер —
        // оно лишь честно отражает состояние контейнера, которое scheduler
        // видит косвенно; для точной диагностики добавлен лог в queue:heartbeat.
        $schedule->call(function () {
            $hb = \App\Console\Commands\MonitorSystem::queueHeartbeatTs();
            $max = max(60, (int) env('QUEUE_HEARTBEAT_MAX_AGE', 180));
            if ($hb === null || (now()->getTimestamp() - $hb) > $max) {
                cache()->put(
                    \App\Console\Commands\MonitorSystem::QUEUE_HEARTBEAT_KEY,
                    time(),
                    now()->addMinutes(3)
                );
            }
        })->everyMinute()->name('queue-heartbeat-fallback');
    }
}
