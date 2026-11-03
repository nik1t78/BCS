<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\CreateVksLinkJob;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\Notification;
use App\Models\Room;
use App\Support\MeetingCache;
use Illuminate\Http\Request;

class MeetingController extends Controller
{
    /**
     * Список конференций
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $query = Meeting::with(['organizer', 'tags'])->accessibleBy($user);
        // Дата для пост-фильтрации occurrence'ов повторяющихся серий (см. RecurrenceService)
        $filterOccurrenceDay = null;

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            // date=YYYY-MM-DD: точная дата + occurrence'ы повторяющихся серий в этот день
            $day = \Carbon\CarbonImmutable::parse($request->date);
            $query->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            });
            $filterOccurrenceDay = $day;
        }

        if ($request->boolean('my')) {
            $query->myMeetings($user->id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('room', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Дополнительные фильтры фильтрационного API
        if ($request->filled('priority')) {
            $query->whereIn('priority', (array) $request->priority);
        }

        if ($request->filled('organizer_id')) {
            $query->where('organizer_id', $request->integer('organizer_id'));
        }

        if ($request->filled('participant_id')) {
            $pid = $request->integer('participant_id');
            $query->where(function($q) use ($pid) {
                $q->whereJsonContains('participants', $pid)->orWhere('organizer_id', $pid);
            });
        }

        if ($request->filled('tag_id')) {
            $query->whereHas('tags', fn($t) => $t->where('tags.id', $request->integer('tag_id')));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('date', '<=', $request->date('date_to'));
        }

        if ($request->boolean('upcoming')) {
            $query->upcoming();
        }

        // Сортировка: allowed fields + направление
        $sortMap = [
            'date' => 'date', 'start' => 'start_time', 'title' => 'title',
            'priority' => 'priority', 'created' => 'created_at', 'status' => 'status',
        ];
        $sortKey = $sortMap[$request->get('sort', 'date')] ?? 'date';
        $direction = $request->get('direction', 'asc') === 'desc' ? 'desc' : 'asc';
        $query->orderBy($sortKey, $direction);
        if ($sortKey !== 'start_time') {
            $query->orderBy('start_time', $direction);
        }

        $perPage = min(max((int) $request->get('per_page', 50), 1), 200);

        if ($filterOccurrenceDay !== null) {
            // Фильтр по дню: из кандидатов (точная дата + серии с окном развёртки)
            // оставляем только те, у кого в этот день реально есть occurrence.
            // Пагинация намеренно отключена — список за один день ограничен.
            $items = $query->limit(500)->get()->filter(
                fn (\App\Models\Meeting $m) => $m->date->toDateString() === $filterOccurrenceDay->toDateString()
                    || \App\Services\RecurrenceService::occursOn($m, $filterOccurrenceDay)
            )->values();

            return response()->json(
                new \Illuminate\Pagination\LengthAwarePaginator(
                    $items->forPage((int) $request->get('page', 1), $perPage),
                    $items->count(),
                    $perPage,
                    (int) $request->get('page', 1)
                )
            );
        }

        $meetings = $query->paginate($perPage);

        return response()->json($meetings);
    }

    /**
     * Нормализация полей формы встречи ДО валидации.
     *
     * 1) start_time/end_time: приводим 'HH:mm:ss' → 'HH:mm'. Laravel-валидатор
     *    сравнивает значения по строкам, и корректная пара «14:30» / «14:30:00»
     *    (например, при редактировании встречи, где фронт вернул серверное
     *    значение с секундами) отбивалась правилом after:start_time — пользователь
     *    видел «время начала должно быть раньше времени окончания», хотя всё верно.
     * 2) link: пустая строка '' не проходит правило `url` («ссылка — корректный
     *    URL»), тогда как nullable принимает null. Приводим пустое к null.
     *    Если вместо ссылки прислали текст приглашения без протокола — дописываем
     *    https:// (иначе `url` тоже его отклоняет).
     * 3) reminder_minutes: из формы приходит строка ("15") или ""; пустое/битое
     *    значение отбивалось правилом min:5 («напоминание — от 5 до 1440 минут»).
     */
    private function normalizeMeetingInput(Request $request): void
    {
        try {
            $this->doNormalizeMeetingInput($request);
        } catch (\Throwable $e) {
            // Нормализация — вспомогательная операция: если внутри неё что-то
            // пошло не так (например, PCRE-ошибка в регулярке), встреча всё
            // равно должна быть создана — данные просто пройдут «как есть»
            // и будут отклонены валидатором с понятной ошибкой 422, а не 500.
            \Illuminate\Support\Facades\Log::warning('normalizeMeetingInput failed: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
        }
    }

    /**
     * Вычёркивает перечисленные символы из строки. Используется вместо
     * preg_replace с \x{...}: на старых PCRE (Alpine/musl) такие шаблоны не
     * компилируются («character code point value in \x{} is too large») и
     * роняли POST /api/meetings с ошибкой 500.
     */
    private function stripChars(string $value, array $chars): string
    {
        foreach ($chars as $ch) {
            $value = str_replace($ch, '', $value);
        }
        return $value;
    }

    private function doNormalizeMeetingInput(Request $request): void
    {
        foreach (['start_time', 'end_time'] as $field) {
            $value = $request->input($field);
            if (is_string($value)) {
                $trimmed = trim($value);
                // '14:30:00' / '14:30:00.000000' → '14:30'
                if (preg_match('/^(\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/', $trimmed, $m)) {
                    $request->merge([$field => $m[1] . ':' . $m[2]]);
                }
            }
        }

        $link = $request->input('link');
        if (is_string($link)) {
            $trimmed = trim($link);
            if ($trimmed === '') {
                $request->merge(['link' => null]);
            } else {
                // Ссылка могла прийти «грязной» после вставки из приглашения:
                // без протокола («salutejazz.ru/calls/abc?psw=123»), с хвостом
                // текста («... Пароль: 123 Войти») или с кавычками. Правило `url`
                // такое отклоняет → фронт показывал «ссылка — корректный URL».
                // Чистим до чистого адреса и дописываем https:// при отсутствии схемы.
                $candidate = $this->stripChars($trimmed, ["'", '"', "“", "”", "<", ">"]);
                if (preg_match('#(?:https?://)?((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/|\?|\#)\S*)#i', $candidate, $m)) {
                    $host = strtolower(parse_url('http://' . $m[1], PHP_URL_HOST) ?: '');
                    if ($host === 'salutejazz.ru' || str_ends_with($host, '.salutejazz.ru')) {
                        // наш ВКС: берём только путь+запрос комнаты, отбрасывая
                        // мусор после ссылки (текст приглашения) и дописывая схему
                        if (preg_match('#(?:https?://)?(?:www\.)?salutejazz\.ru(/calls/\S*)#i', $candidate, $p)) {
                            $path = rtrim($p[1], " \t\n\r\0\x0B\'\"“”<>,;");
                            $request->merge(['link' => 'https://salutejazz.ru' . $path]);
                        } else {
                            $request->merge(['link' => 'https://' . $m[1]]);
                        }
                    } elseif (!preg_match('#^https?://#i', $candidate)) {
                        // посторонний домен без схемы — дописываем https://
                        $request->merge(['link' => 'https://' . $m[1]]);
                    } else {
                        $request->merge(['link' => $trimmed]);
                    }
                } else {
                    $request->merge(['link' => $trimmed]);
                }
            }
        }

        $reminder = $request->input('reminder_minutes');
        if ($reminder !== null) {
            $n = is_string($reminder) ? (int) trim($reminder) : (int) $reminder;
            if ($n < 5) {
                $n = 15; // адекватный дефолт вместо отклонения всей заявки
            } elseif ($n > 1440) {
                $n = 1440;
            }
            $request->merge(['reminder_minutes' => $n]);
        }

        // Дата: нормализуем к каноничному YYYY-MM-DD ДО валидации и записи.
        // Колонка `date` приведена к формату Y-m-d, но Carbon::parse может
        // стартовать с другой таймзоны: например ISO-строка «2026-10-31T21:00:00Z»
        // при сервере Europe/Moscow (+03) даёт локальные сутки «01.11», а строка
        // вида «2026-10-30T23:00:00+03:00» в UTC — «29.10». Пользователь выбирал
        // 31-е, а записывалось 30-е. Берём ТОЛЬКО календарную часть принятой
        // строки (то, что реально видно в поле формы), без пересчёта поясов.
        $date = $request->input('date');
        if (is_string($date)) {
            $trimmed = trim($date);
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/', $trimmed, $m)) {
                $request->merge(['date' => sprintf('%04d-%02d-%02d', $m[1], $m[2], $m[3])]);
            } elseif (preg_match('/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(?:[T ].*)?$/', $trimmed, $m)) {
                // DD.MM.YYYY / DD/MM/YYYY — тот же формат показывает UI
                $request->merge(['date' => sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1])]);
            }
        }
    }

    /**
     * Создание конференции
     */
    public function store(Request $request)
    {
        $this->normalizeMeetingInput($request);

        // Точная причина отклонения заявки (для сообщения на фронте вместо
        // универсального «проверьте поля»): заполняется при автофиксах ниже.
        $autoFixNotes = [];

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'date' => 'required|date',
            // Формат времени принимаем и HH:mm, и HH:mm:ss — серверные колонки
            // TIME могут хранить значение с секундами ('14:30:00'), и при
            // редактировании встречи фронт отправляет их обратно как есть.
            // Жёсткий date_format:H:i тогда отбивал валидацию (422) или
            // «after:start_time» падал на сравнении строк разной длины.
            'start_time' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            // ВНИМАНИЕ: сравнение валидатора Laravel идёт ПО СТРОКАМ. Фронт
            // шлёт 'HH:mm', а при редактировании серверные значения могут
            // прийти как 'HH:mm:ss' — строка '14:30' меньше '14:30:00', и
            // корректная пара «14:30 / 14:30:00» отбивалась правилом
            // after (фронт показывал «время начала должно быть раньше
            // окончания»). Нормализуем оба значения к HH:mm ДО валидации
            // (normalizeTimeFields), поэтому здесь безопасно H:i.
            'end_time' => ['required', 'regex:/^\d{2}:\d{2}(:\d{2})?$/', 'after:start_time'],
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'priority' => 'required|in:low,medium,high',
            'reminder_minutes' => 'required|integer|min:5|max:1440',
            'recurring' => 'required|in:none,daily,weekly,monthly,custom',
            'rrule' => 'nullable|string|max:255',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
            'repeat_until' => 'nullable|date',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        $this->validateRoomAccess($request, $validated["room"] ?? null);

        // Заявки в прошедшее время создавать нельзя (как и на фронте):
        // дата не раньше сегодня, а если сегодня — начало не раньше «сейчас».
        // ВАЖНО: сервер НЕ меняет выбранную пользователем дату ни в каком
        // виде — только проверяет и сохраняет ровно то, что пришло из формы.
        // ГРЕЙС-ПЕРИОД 5 минут: пользователь мог выбрать слот, который начался
        // буквально минуту назад («09:29, а жму Создать в 09:31») — такая
        // заявка по сути ещё актуальна, отбивать её с 422/500 означало бы
        // «не могу создать ВКС на сегодня» при каждом опоздании на шаг формы.
        $now = \Carbon\CarbonImmutable::now();
        $startAt = \Carbon\CarbonImmutable::parse($validated['date'])->setTimeFromTimeString($validated['start_time']);
        if ($startAt->lessThan($now->copy()->subMinutes(5))) {
            $todayKey = $now->toDateString();
            // «Сегодня по часам компьютера пользователя» (echo_client_today —
            // добавляет фронт) используется ТОЛЬКО как подсказка в тексте
            // ошибки, если часы машины пользователя отстают от серверных.
            $clientToday = trim((string) $request->input('echo_client_today', ''));
            $clockLagHint = ($clientToday !== '' && $clientToday !== $todayKey)
                ? ' По часам вашего компьютера сейчас ' . $clientToday . ', по серверным — ' . $todayKey . '. Проверьте дату/время и часовой пояс в настройках системы.'
                : '';
            // Защита от ТИХОЙ записи прошедшей даты («выбрал 02.11, а записало
            // 01.11»). Если присланная дата совпадает с локальным «сегодня»
            // клиента (echo_client_today), на сервер долетел устаревший дефолт
            // формы / кривой offset. Молча сохранять нельзя; молча переносить
            // тоже запрещено (дата всегда остаётся выбранной пользователем) —
            // отбиваем с ясной подсказкой. Формулировка НЕ должна утверждать,
            // что пользователь выбирал другую дату: при корректных часах он
            // действительно мог выбрать «вчера» руками — поэтому текст
            // нейтральный и предлагает просто выбрать нужный день заново.
            $isStaleClientToday = ($clientToday !== '' && $clientToday === $validated['date']);
            $message = $isStaleClientToday
                ? 'Эта дата уже прошла по серверным часам (сейчас ' . $todayKey . '). Выберите нужный день в календаре заново и нажмите «Создать ВКС» ещё раз.' . $clockLagHint
                : 'Нельзя создать встречу в прошедшем времени. Выберите будущую дату или более поздний слот.' . $clockLagHint;
            throw \Illuminate\Validation\ValidationException::withMessages([
                'start_time' => [$message],
            ]);
        }

        // Автофикс «конец раньше/равен началу»: встреча с нулевой длительностью
        // бессмысленна, но отбивать всю заявку из-за этого — плохой UX
        // (фронт показывал только «время начала должно быть раньше окончания»).
        // Сдвигаем конец на +60 мин; если вылез за полночь — просим начать раньше.
        $endAt = \Carbon\CarbonImmutable::parse($validated['date'])->setTimeFromTimeString($validated['end_time']);
        if ($endAt->lessThanOrEqualTo($startAt)) {
            $candidateEnd = $startAt->copy()->addHour();
            if ($candidateEnd->greaterThan($startAt->copy()->endOfDay())) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'start_time' => ['Встреча не может заканчиваться позже полуночи. Выберите более раннее время начала.'],
                ]);
            }
            $validated['end_time'] = $candidateEnd->format('H:i');
            $autoFixNotes[] = 'окончание автоматически сдвинуто на ' . $validated['end_time'];
        }

        // Длительность по умолчанию: если фронт прислал пустой end_time (или
        // равный началу до нормализации) — встреча 1 час, а НЕ «съеханные»
        // произвольные значения. Это гарантирует, что сохранённая пара
        // начало/конец совпадает с тем, что пользователь видел в форме.
        if (!array_key_exists('end_time', $validated) || $validated['end_time'] === null || $validated['end_time'] === '') {
            $candidateEnd = $startAt->copy()->addHour();
            if ($candidateEnd->lessThanOrEqualTo($startAt->copy()->endOfDay())) {
                $validated['end_time'] = $candidateEnd->format('H:i');
            }
        }

        // Валидация даты: Laravel 'date' пропускает любой парсинг Carbon
        // (в т.ч. относительные строки). Строго принимаем YYYY-MM-DD или
        // DD.MM.YYYY — иначе битая дата из формы могла лечь в БД «как есть».
        // ФИКС «выбрал 03.11, а расписание показывает 02.11»: раньше дата
        // проходила через Carbon::parse($raw)->toDateString(). Если фронт
        // присылает полный ISO-таймстемп ("2026-11-03T00:00:00.000Z"), parse
        // трактует его как UTC и переводит в пояс приложения; при поясе
        // западнее UTC (или кривом TZ контейнера) сутки уезжали НАЗАД —
        // выбранное «03» сохранялось как «02». Теперь канон Y-m-d берётся
        // ПРЯМО ИЗ СТРОКИ регуляркой (календарные компоненты без поясов),
        // перестановка суток невозможна в принципе.
        $rawDate = (string) $request->input('date');
        $canonFromValidated = '';
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', substr(trim((string) $validated['date']), 0, 10), $dm)) {
            $canonFromValidated = sprintf('%04d-%02d-%02d', (int) $dm[1], (int) $dm[2], (int) $dm[3]);
        }
        // Из СТРОКИ ЗАПРОСА тоже извлекаем канон регуляркой — НЕ через
        // Carbon::parse: Laravel-валидатор 'date' уже мог прогнать значение
        // через DateTimeInterface и вернуть Carbon, созданный из ISO-строки
        // «...T...Z» по поясу UTC (дата могла уехать на сутки). Если в сырой
        // строке есть явные календарные компоненты YYYY-MM-DD — верим им.
        $canonFromRaw = '';
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', trim($rawDate), $rm)) {
            $canonFromRaw = sprintf('%04d-%02d-%02d', (int) $rm[1], (int) $rm[2], (int) $rm[3]);
        }
        if ($canonFromRaw !== '') {
            $validated['date'] = $canonFromRaw;
        } elseif ($canonFromValidated !== '') {
            $validated['date'] = $canonFromValidated;
        } elseif ($rawDate !== '') {
            // неканоничный формат («03.11.2026» уже смержено выше в store,
            // но сторонние клиенты могут прислать что угодно) — единственный
            // случай, где допустим парсинг Carbon; forceTZ убирает суточный
            // сдвиг при разборе строки БЕЗ таймзоны как UTC-полночь
            $validated['date'] = \Carbon\CarbonImmutable::parse($validated['date'], new \DateTimeZone($now->timezone()->getName()))->toDateString();
        }

        $validated['organizer_id'] = $request->user()->id;
        
        $tags = $validated['tags'] ?? null;
        unset($validated['tags']);

        if (in_array($validated['recurring'] ?? 'none', ['none'], true)) {
            $validated['repeat_until'] = null;
        }

        // Если MySQL отклонил вставку (например, колонки start_time/end_time ещё
        // не конвертированы миграцией fix_meetings_time_columns_for_mysql8 и
        // strict-режим ругается «Data truncated for column»), раньше это
        // улетало в голый 500 «Server Error» без объяснений. Превращаем такую
        // ошибку в 422 с конкретной причиной, понятной пользователю.
        try {
            $meeting = Meeting::create($validated);
        } catch (\Illuminate\Database\QueryException $e) {
            report($e);
            $friendly = self::friendlyDbError($e);
            if ($friendly !== null) {
                throw \Illuminate\Validation\ValidationException::withMessages([$friendly[0] => [$friendly[1]]]);
            }
            // Неизвестная ошибка БД: вместо голого 500 «Server Error» отдаём
            // 422 — фронт покажет текст причины, а полная трассировка
            // останется в storage/logs/laravel.log.
            throw new \Symfony\Component\HttpKernel\Exception\HttpException(
                422,
                'Сервер отклонил запись встречи в базу данных. Подробности — в логах бэкенда (storage/logs/laravel.log).',
                $e,
            );
        } catch (\Throwable $e) {
            // Любая неожиданная ошибка (несовпадение кода и схемы после
            // деплоя, отсутствующая колонка/таблица и т.п.) больше не
            // превращается в необъяснимый 500: логируем и отдаём 422 с
            // человеческим текстом — пользователь видит причину сразу.
            report($e);
            throw new \Symfony\Component\HttpKernel\Exception\HttpException(
                422,
                'Не удалось сохранить встречу на сервере: ' . $e->getMessage(),
                $e,
            );
        }

        if ($tags !== null) {
            $meeting->tags()->sync($tags);
        }

        // Создаём уведомления для участников. Встреча уже сохранена в БД,
        // поэтому сбой здесь (недоступная таблица notifications, некорректный
        // id участника и т.п.) НЕ должен превращаться в 500 — иначе фронт
        // показывает ошибку «Server Error», а встреча фактически создана.
        try {
            foreach ($validated['participants'] ?? [] as $participantId) {
                if ((int) $participantId !== (int) $request->user()->id) {
                    Notification::create([
                        'user_id' => $participantId,
                        'meeting_id' => $meeting->id,
                        'message' => "👤 Вас добавили в конференцию \"{$meeting->title}\"",
                        'type' => 'user-added',
                        'read' => false,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }

        try {
            AuditLog::log($request, 'meeting_created', $meeting, [], [
                'title' => $meeting->title,
                'date' => $meeting->date,
                'start_time' => $meeting->start_time,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        MeetingCache::bump([$this->roomIdOf($meeting->room)]);

        // Пункт 1 плана (очередь + автопилот): если ссылка ВКС не задана и
        // автосоздание через бота включено на сервере (VKSBOT_AUTO=true),
        // встреча сохраняется БЕЗ ссылки, а живую комнату бот создаёт
        // асинхронно в очереди (ретраи 30/60 с). Фронт при этом мгновенно
        // получает ответ и показывает локальную ссылку-заглушку.
        // При QUEUE_CONNECTION=sync джоб выполнится сразу — поведение как
        // раньше, только без ожидания в HTTP-запросе фронтенда.
        try {
            if (empty($validated['link']) && config('services.vks_bot.auto', false)) {
                CreateVksLinkJob::dispatch($meeting->id);
            }
        } catch (\Throwable $e) {
            report($e); // очередь недоступна — встреча всё равно создана
        }

        // WebSocket-уведомление экранам ТВ зала о появлении новой встречи.
        MeetingCache::bump([$this->roomIdOf($meeting->room)]);

        // additional() есть не во всех версиях Illuminate — используем совместимый способ
        $payload = $meeting->load(['organizer', 'tags'])->toArray();
        if (!empty($autoFixNotes)) {
            $payload['warnings'] = $autoFixNotes;
        }

        return response()->json($payload, 201);
    }

    /**
     * Получить конференцию
     */
    public function show(Request $request, Meeting $meeting)
    {
        if (!$meeting->hasAccess($request->user())) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Обновление конференции
     */
    public function update(Request $request, Meeting $meeting)
    {
        $user = $request->user();
        $oldRoomName = $meeting->room;

        // Право редактировать: организатор, админ, модератор или участник встречи
        // (по запросу участников они могут править название/время и смотреть описание).
        $isParticipant = in_array($user->id, array_map('intval', $meeting->participants ?? []), true);
        if ($meeting->organizer_id !== $user->id && !$user->isAdmin() && !$user->isModerator() && !$isParticipant) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $this->normalizeMeetingInput($request);

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'date' => 'sometimes|date',
            'start_time' => ['sometimes', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'end_time' => ['sometimes', 'regex:/^\d{2}:\d{2}(:\d{2})?$/', 'after:start_time'],
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'status' => 'sometimes|in:scheduled,in-progress,completed,cancelled',
            'priority' => 'sometimes|in:low,medium,high',
            'reminder_minutes' => 'sometimes|integer|min:5|max:1440',
            'recurring' => 'sometimes|in:none,daily,weekly,monthly,custom',
            'rrule' => 'nullable|string|max:255',
            'participants' => 'nullable|array',
            'participants.*' => 'integer|exists:users,id',
            'participant_emails' => 'nullable|array',
            'participant_emails.*' => 'email',
            'is_private' => 'boolean',
            'repeat_until' => 'nullable|date',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        if (array_key_exists('room', $validated)) {
            $this->validateRoomAccess($request, $validated['room']);
        }

        $tags = $validated['tags'] ?? null;
        unset($validated['tags']);

        if (array_key_exists('recurring', $validated) && $validated['recurring'] === 'none') {
            $validated['repeat_until'] = null;
        }

        $fields = array_keys($validated);
        $oldValues = collect($meeting->only($fields))->toArray();
        $meeting->update($validated);

        if ($tags !== null) {
            $meeting->tags()->sync($tags);
        }

        try {
            AuditLog::log($request, 'meeting_updated', $meeting, $oldValues, $meeting->only($fields));
        } catch (\Throwable $e) {
            report($e); // аудит не должен ломать уже выполненное обновление (500)
        }

        // Уведомление организатору, если встречу изменил НЕ он (перенос/правка
        // участником). Раньше владелец узнавал об изменении только по факту —
        // функционал «отмена/перенос участником с уведомлением владельца»
        // был реализован лишь для reschedule/cancel, но не для update.
        if ((int) $meeting->organizer_id !== (int) $user->id) {
            $scheduleChanged = ($oldValues['date'] ?? null) != $meeting->date?->toDateString()
                || substr((string) ($oldValues['start_time'] ?? ''), 0, 5) !== substr((string) $meeting->start_time, 0, 5);
            $titleChanged = ($oldValues['title'] ?? null) !== null && $oldValues['title'] !== $meeting->title;
            $what = $scheduleChanged
                ? 'изменено время: ' . $meeting->date->format('d.m.Y') . ' ' . substr((string) $meeting->start_time, 0, 5)
                : ($titleChanged ? "новое название: \"{$meeting->title}\"" : 'обновлены данные');
            try {
                Notification::create([
                    'user_id' => $meeting->organizer_id,
                    'meeting_id' => $meeting->id,
                    'message' => "✏️ Участник {$user->name} изменил конференцию \"{$meeting->title}\" — {$what}.",
                    'type' => 'info',
                    'read' => false,
                ]);
            } catch (\Throwable $e) {
                report($e); // правка уже сохранена — уведомление не должно давать 500
            }
        }

        MeetingCache::bump(array_filter([\App\Support\MeetingCache::roomIdsFromNames([$oldRoomName ?? null, $meeting->room ?? null])]));

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Удаление конференции
     */
    public function destroy(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        try {
            AuditLog::log($request, 'meeting_deleted', $meeting, [
                'title' => $meeting->title,
                'date' => $meeting->date,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        // Мягкое удаление: встреча попадает в корзину (MeetingTrashController),
        // откуда её можно восстановить. Уведомляем участников.
        $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
        foreach ($targets as $userId) {
            if ((int) $userId === (int) $user->id) continue;
            try {
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "🗑 Конференция \"{$meeting->title}\" ({$meeting->date->format('d.m.Y')} {$meeting->start_time}) удалена организатором. Её можно восстановить из корзины.",
                    'type' => 'warning',
                    'read' => false,
                ]);
            } catch (\Throwable $e) {
                report($e); // уведомление — не критично для самого удаления
            }
        }

        $meeting->delete();

        MeetingCache::bump([$this->roomIdOf($meeting->room)]);

        return response()->json(['message' => 'Конференция перемещена в корзину']);
    }

    /**
     * Отмена конференции с уведомлением всех участников
     */
    public function cancel(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ($meeting->organizer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ($meeting->status === 'cancelled') {
            return response()->json(['message' => 'Конференция уже отменена'], 422);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $oldStatus = $meeting->status;
        $meeting->update(['status' => 'cancelled']);

        $suffix = !empty($validated['reason']) ? " Причина: {$validated['reason']}" : '';
        $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
        foreach ($targets as $userId) {
            if ((int) $userId === (int) $user->id) continue; // инициатору уведомление не нужно
            try {
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "❌ Конференция \"{$meeting->title}\" ({$meeting->date->format('d.m.Y')} {$meeting->start_time}) отменена.{$suffix}",
                    'type' => 'warning',
                    'read' => false,
                ]);
            } catch (\Throwable $e) {
                report($e); // отмена уже выполнена — уведомления не должны давать 500
            }
        }

        try {
            AuditLog::log($request, 'meeting_cancelled', $meeting, ['status' => $oldStatus], ['status' => 'cancelled', 'reason' => $validated['reason'] ?? null]);
        } catch (\Throwable $e) {
            report($e);
        }

        MeetingCache::bump([$this->roomIdOf($meeting->room)]);

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Перенос конференции на другую дату/время (drag&drop в Schedule).
     * Уведомляет участников об изменении расписания.
     */
    public function reschedule(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        // Перенос доступен организатору, админу, модератору и участникам встречи.
        $isParticipant = in_array($user->id, array_map('intval', $meeting->participants ?? []), true);
        if ($meeting->organizer_id !== $user->id && !$user->isAdmin() && !$user->isModerator() && !$isParticipant) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'notify' => 'sometimes|boolean',
            'force' => 'sometimes|boolean',
        ]);

        $newEnd = substr($validated['end_time'] ?? $meeting->end_time, 0, 5);
        // Канон YYYY-MM-DD без Carbon::parse: берём календарную часть строки как есть.
        // Carbon::parse для «2026-11-03» даёт полночь Europe/Moscow, а приведение
        // к UTC (сохранение/сравнение) сдвигает сутки назад — выбрал 03.11,
        // сохранилось 02.11. Прямой regex исключает любые таймзонные сдвиги.
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', trim((string)$validated['date']), $dm)) {
            $newDate = "{$dm[1]}-{$dm[2]}-{$dm[3]}";
        } else {
            $newDate = substr(trim((string)$validated['date']), 0, 10);
        }

        // Серверная валидация конфликтов: у организатора/участников не должно
        // быть пересечений на новом слоте (если перенос не подтверждён force=true).
        if (!$request->boolean('force')) {
            $people = array_unique(array_merge(
                [$meeting->organizer_id],
                array_map('intval', $meeting->participants ?? []),
            ));
            foreach ($people as $uid) {
                if (ScheduleConflictController::userHasConflict($uid, $newDate, $validated['start_time'], $newEnd, $meeting->id)) {
                    return response()->json([
                        'message' => 'На новом времени у участника уже есть встреча. Повторите запрос с force=true, если перенос всё равно нужен.',
                        'conflict_user_id' => $uid,
                    ], 409);
                }
            }
        }

        $oldRoomName = $meeting->room;
        $oldDate = $meeting->date->toDateString();
        $oldStart = substr((string) $meeting->start_time, 0, 5);

        $meeting->update([
            // ВАЖНО: сохраняем НОРМАЛИЗОВАННУЮ дату ($newDate = toDateString()),
            // а не сырую $validated['date']: если фронт прислал ISO-строку с
            // таймзоной («2026-10-31T21:00:00Z»), Carbon::parse без явной зоны
            // даёт другие сутки и встреча «уезжала» на 30-е.
            'date' => $newDate,
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'] ?? $meeting->end_time,
        ]);

        if ($request->boolean('notify', true)) {
            $suffix = ($oldDate !== $meeting->date->toDateString())
                ? " было: {$oldDate} {$oldStart}"
                : " время было: {$oldStart}";
            $targets = array_unique(array_merge([$meeting->organizer_id], $meeting->participants ?? []));
            foreach ($targets as $userId) {
                if ($userId === $user->id) continue;
                Notification::create([
                    'user_id' => $userId,
                    'meeting_id' => $meeting->id,
                    'message' => "📅 Конференция \"{$meeting->title}\" перенесена на {$meeting->date->format('d.m.Y')} {$validated['start_time']},{$suffix}",
                    'type' => 'info',
                    'read' => false,
                ]);
            }
        }

        AuditLog::log($request, 'meeting_rescheduled', $meeting,
            ['date' => $oldDate, 'start_time' => $oldStart],
            ['date' => $meeting->date->toDateString(), 'start_time' => $validated['start_time']]);

        // Инвалидация кэша доступности залов (перенос меняет занятость обеих дат).
        MeetingCache::bump(array_filter([\App\Support\MeetingCache::roomIdsFromNames([$oldRoomName ?? null, $meeting->room ?? null])]));

        return response()->json($meeting->load(['organizer', 'tags']));
    }

    /**
     * Статистика конференций
     */
    public function getStats(Request $request)
    {
        $user = $request->user();
        $query = Meeting::accessibleBy($user);

        return response()->json([
            'total' => (clone $query)->count(),
            'scheduled' => (clone $query)->where('status', 'scheduled')->count(),
            'in_progress' => (clone $query)->where('status', 'in-progress')->count(),
            'completed' => (clone $query)->where('status', 'completed')->count(),
            'cancelled' => (clone $query)->where('status', 'cancelled')->count(),
            'this_week' => (clone $query)->whereBetween('date', [
                now()->startOfWeek(),
                now()->endOfWeek()
            ])->count(),
            'high_priority' => (clone $query)->where('priority', 'high')->count(),
        ]);
    }

    /**
     * RBAC комнат по подразделениям: комнату, привязанную к отделу
     * (rooms.department_id), могут бронировать только сотрудники этого отдела,
     * admin/moderator. Комнаты без department_id — публичные (любые).
     */
    /**
     * Перевод типичных ошибок MySQL в понятные сообщения для пользователя
     * (вместо голого 500 «Server Error»). Возвращает [поле, сообщение] или null.
     */
    private static function friendlyDbError(\Illuminate\Database\QueryException $e): ?array
    {
        $msg = strtolower($e->getMessage());
        if (str_contains($msg, 'data truncated') || str_contains($msg, 'incorrect datetime')
            || str_contains($msg, 'start_time') || str_contains($msg, 'end_time')) {
            return ['start_time', 'Сервер отклонил формат времени при сохранении. Выполните на сервере: docker compose exec backend php artisan migrate --force'];
        }
        if (str_contains($msg, 'base table or view not found')) {
            $table = preg_match("/base table or view not found:.*?\s(?:table|view)\s+['`\"]?(\w+)/i", $e->getMessage(), $m) ? $m[1] : null;
            return ['title', 'В базе данных отсутствует таблица' . ($table ? " \u00ab{$table}\u00bb" : '') . '. Выполните на сервере: docker compose exec backend php artisan migrate --force'];
        }
        if (str_contains($msg, 'unknown column')) {
            $col = preg_match("/unknown column ['`\"]?(\w+)/i", $e->getMessage(), $m) ? $m[1] : null;
            return ['title', 'Схема базы данных устарела' . ($col ? ": отсутствует колонка \u00ab{$col}\u00bb" : '') . '. Выполните на сервере: docker compose exec backend php artisan migrate --force'];
        }
        return null;
    }

    /**
     * ID зала из справочника по названию встречи (для WebSocket-уведомлений экранам ТВ).
     */
    private function roomIdOf(?string $roomName): ?int
    {
        if ($roomName === null || trim($roomName) === '') {
            return null;
        }
        return \App\Models\Room::where('name', trim($roomName))->value('id');
    }


    private function validateRoomAccess(Request $request, ?string $roomName): void
    {
        if ($roomName === null || trim($roomName) === '') {
            return;
        }
        $user = $request->user();
        if ($user->isAdmin() || $user->isModerator()) {
            return;
        }
        $room = Room::where('name', $roomName)->first();
        // Свободный текст в поле room (не из справочника) разрешаем как раньше
        if (!$room || !$room->department_id) {
            return;
        }
        // Сопоставление: department_id комнаты может храниться как числовой id
        // или совпадать с названием отдела пользователя. Таблицы departments в
        // схеме нет — сверяем напрямую значения (число↔число, строка↔строка).
        $userDept = trim((string) ($user->department ?? ''));
        $roomDept = trim((string) $room->department_id);
        $matches = $userDept !== ''
            && ($userDept === $roomDept || (is_numeric($userDept) && (int) $userDept === (int) $roomDept));
        if (!$matches) {
            abort(403, 'Эта комната закреплена за другим подразделением');
        }
    }
}
