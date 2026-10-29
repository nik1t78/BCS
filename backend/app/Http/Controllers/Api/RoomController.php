<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Room;
use App\Support\SafeCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RoomController extends Controller
{
    /**
     * Список комнат (для справочника/селекта).
     * GET /rooms
     */
    public function index(Request $request)
    {
        // Справочник комнат доступен всем авторизованным (модалка выбора зала
        // и виджет «Свободные залы» нужны в т.ч. обычной роли «user»).
        // Для совместимости с фронтендом отдаём оба поля статуса.
        // tv_token (доступ к экрану ТВ без логина) показываем ТОЛЬКО администратору.
        $isAdmin = optional($request->user())->role === 'admin';
        $rooms = Room::orderBy('name')->get()->map(function (Room $room) use ($isAdmin) {
            $room->setAttribute('is_active', (bool) $room->is_active);
            $room->setAttribute('isActive', (bool) $room->is_active);
            if ($isAdmin) {
                if (!$room->tv_token) {
                    $room->forceFill(['tv_token' => bin2hex(random_bytes(16))])->saveQuietly();
                }
                $room->makeVisible('tv_token');
            }
            return $room;
        });

        return response()->json(['data' => $rooms]);
    }

    /**
     * Доступность комнаты на указанный день: занятые интервалы + свободные слоты.
     * GET /rooms/{room}/availability?date=YYYY-MM-DD&start_time=HH:MM&end_time=HH:MM
     */
    public function availability(Request $request, Room $room)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'exclude' => 'nullable|integer', // id редактируемой встречи
        ]);

        $day = \Carbon\CarbonImmutable::parse($validated['date']);

        // Занятость комнаты: точные даты + occurrence'ы повторяющихся серий (RRULE на бэкенде)
        $bookings = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->where('room', $room->name)
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->when(!empty($validated['exclude']), fn ($q) => $q->where('id', '!=', $validated['exclude']))
            ->orderBy('start_time')
            ->get(['id', 'title', 'date', 'start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->filter(fn (Meeting $m) => $m->date->toDateString() === $day->toDateString()
                || \App\Services\RecurrenceService::occursOn($m, $day));

        $busy = $bookings->map(fn ($m) => [
            'meeting_id' => $m->id,
            'title' => $m->title,
            'start' => substr((string) $m->start_time, 0, 5),
            'end' => substr((string) $m->end_time, 0, 5),
        ])->values();

        // Гибкий график зала (рабочие часы по дням недели + праздники).
        // До фикса был жёстко зашит 08:00–20:00. Пустой массив schedule у
        // старых залов трактуем как «не задан» (дефолт), а не как дни с
        // start=null — иначе парсинг времени падал с fatal error.
        $raw = $room->schedule;
        $hours = $room->hoursForDateNormalized(
            $day->toDateString(),
            is_array($raw) && !empty($raw) ? $raw : null
        );
        $dayStart = $hours['start'] ?? '08:00';
        $dayEnd = $hours['end'] ?? '20:00';

        // Свободные слоты в рабочих часах зала на эту дату
        $free = [];
        $cursor = $dayStart;
        foreach ($busy as $b) {
            if ($b['start'] > $cursor) {
                $free[] = ['start' => $cursor, 'end' => min($b['start'], $dayEnd)];
            }
            if ($b['end'] > $cursor) {
                $cursor = $b['end'];
            }
        }
        if ($cursor < $dayEnd) {
            $free[] = ['start' => $cursor, 'end' => $dayEnd];
        }

        // Проверка конкретного интервала (для формы создания встречи)
        $available = true;
        if (!empty($validated['start_time']) && !empty($validated['end_time'])) {
            $from = $validated['start_time'];
            $to = $validated['end_time'];
            $available = !$busy->contains(fn ($b) => $from < $b['end'] && $to > $b['start']);
        }

        return response()->json([
            'room' => $room,
            'date' => $validated['date'],
            'busy' => $busy,
            'free' => $free,
            'available' => $available,
            'hours' => $hours, // null = зал закрыт на эту дату (праздник/выходной)
        ]);
    }

    /**
     * Агрегированная доступность ВСЕХ активных залов на дату за один запрос.
     * Доступно всем авторизованным (включая роль «user», у которой нет прав
     * на справочник GET /rooms) — используется виджетом «Свободные залы».
     * GET /meetings/rooms-availability?date=YYYY-MM-DD
     */
    public function allAvailability(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
        ]);

        $day = \Carbon\CarbonImmutable::parse($validated['date']);

        // Кэш доступности (Redis, TTL 45 с): виджет «Свободные залы» поллит
        // этот эндпоинт каждые 30–60 с, а запрос тяжёлый — раскрывает серии
        // повторов (RecurrenceService::occursOn) для всех встреч дня.
        // Инвалидируется MeetingCache::bump() при любом изменении встреч
        // (создание/перенос/отмена/удаление), поэтому актуальность не страдает.
        return $this->availabilityResponse($day);
    }

    /**
     * Собрать ответ доступности всех залов на дату (с кэшем и меткой версии).
     */
    private function availabilityResponse(\Carbon\CarbonImmutable $day): \Illuminate\Http\JsonResponse
    {
        // Ключ содержит только дату (без версии): bump() больше не пишет в
        // Redis микросекундную метку — иначе каждый запрос после любого
        // изменения встреч становился cache-miss и гонял тяжёлую выборку
        // заново. Актуальность обеспечивается коротким TTL + явным
        // Cache::forget() во MeetingCache::bump().
        $key = 'rooms:avail:v2:' . $day->toDateString();

        // Короткий TTL: виджет поллит каждые 30–60 с.
        try {
            $payload = Cache::remember($key, 45, function () use ($day) {
                return [
                    'data' => $this->buildAllAvailability($day),
                    'date' => $day->toDateString(),
                ];
            });
        } catch (\Throwable $e) {
            // Redis упал/недоступен или значение в кэше повреждено —
            // отдаём «живой» расчёт вместо 500 (данные всё равно корректны).
            report($e);
            $payload = null;
        }

        // Страховка от «битого» кэша (значение записано другим драйвером/
        // версией приложения): если структура не та — пересобираем payload
        // напрямую, минуя кэш. Иначе любой exception при сериализации ответа
        // давал бы 500.
        if (!is_array($payload) || !isset($payload['data']) || !is_array($payload['data'])) {
            try {
                Cache::forget($key);
            } catch (\Throwable) {
                // недоступный кэш не должен мешать ответу
            }

            try {
                $payload = [
                    'data' => $this->buildAllAvailability($day),
                    'date' => $day->toDateString(),
                ];
            } catch (\Throwable $e) {
                // Аварийный минимум: без него любая ошибка в тяжёлом запросе
                // (кривая серия повторов, отсутствующая колонка schedule после
                // частичной миграции и т.п.) роняла весь эндпоинт с 500.
                // Фронт получит пустой список — виджет покажет «нет данных»,
                // но приложение останется рабочим. Причина — в laravel.log
                // ([API-ERROR]) и в алерте админу (bootstrap/app.php).
                $this->logAvailabilityFailure($e, $request = request());
                report($e);

                $fallbackRooms = [];
                try {
                    $fallbackRooms = Room::where('is_active', true)
                        ->orderBy('name')
                        ->get(['id', 'name', 'capacity'])
                        ->map(fn (Room $r) => [
                            'id' => $r->id,
                            'name' => $r->name,
                            'capacity' => $r->capacity,
                            'busy' => [],
                            'free' => [],
                            'hours' => null,
                        ])->all();
                } catch (\Throwable $inner) {
                    report($inner);
                }

                $payload = [
                    'data' => $fallbackRooms,
                    'date' => $day->toDateString(),
                    'degraded' => true,
                ];
            }
        }

        return response()->json($payload);
    }

    /**
     * Диагностика 500 на эндпоинте доступности: пишет в laravel.log компактную
     * сводку состояния (драйвер кэша, версия БД, число залов/встреч, класс и
     * место исходной ошибки). Раньше причина была доступна только через
     * браузер (APP_DEBUG=false скрывал detail), и фиксы вслепую не сходились.
     */
    private function logAvailabilityFailure(\Throwable $e, $request): void
    {
        try {
            $detail = [
                'msg'   => get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine(),
                'cache' => config('cache.default'),
                'db'    => config('database.default'),
            ];
            try {
                $detail['rooms'] = \Illuminate\Support\Facades\DB::table('rooms')->count();
            } catch (\Throwable $t) {
                $detail['rooms'] = 'ERR:' . $t->getMessage();
            }
            try {
                $detail['meetings'] = \Illuminate\Support\Facades\DB::table('meetings')->count();
            } catch (\Throwable $t) {
                $detail['meetings'] = 'ERR:' . $t->getMessage();
            }
            // Колонки, без которых buildAllAvailability падает: schedule у
            // rooms и rrule/repeat_until/recurring/status у meetings. Если
            // миграция применилась частично — здесь это будет видно в логе.
            try {
                $roomCols = \Illuminate\Support\Facades\Schema::getColumnListing('rooms');
                $detail['room_schedule'] = in_array('schedule', $roomCols, true) ? 'ok' : 'MISSING';
            } catch (\Throwable $t) {
                $detail['room_schedule'] = 'ERR:' . $t->getMessage();
            }
            try {
                $mCols = \Illuminate\Support\Facades\Schema::getColumnListing('meetings');
                $detail['meeting_cols'] = implode(',', array_values(array_intersect(
                    ['recurring', 'repeat_until', 'rrule', 'status', 'room', 'date', 'start_time', 'end_time'],
                    $mCols
                )));
            } catch (\Throwable $t) {
                $detail['meeting_cols'] = 'ERR:' . $t->getMessage();
            }
            try {
                $detail['url'] = $request?->fullUrl();
            } catch (\Throwable) {
            }

            \Illuminate\Support\Facades\Log::error('[AVAIL-DIAG] ' . json_encode($detail, JSON_UNESCAPED_UNICODE));
        } catch (\Throwable) {
            // диагностика не должна ломать ответ
        }
    }

    /**
     * Тяжёлая часть: все активные залы + занятость/окна на дату.
     */
    private function buildAllAvailability(\Carbon\CarbonImmutable $day)
    {
        $rooms = Room::where('is_active', true)->orderBy('name')->get(['id', 'name', 'capacity']);

        // Все встречи на день (точные + потенциальные occurrence повторяющихся серий)
        $bookings = Meeting::query()
            ->where(function ($w) use ($day) {
                $w->whereDate('date', $day->toDateString())
                  ->orWhere(function ($r) use ($day) {
                      $r->where('recurring', '!=', 'none')
                        ->whereNotNull('recurring')
                        ->whereDate('date', '<=', $day->toDateString())
                        ->whereDate('date', '>=', $day->copy()->subDays(\App\Services\RecurrenceService::HORIZON_DAYS)->toDateString());
                  });
            })
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->whereNotNull('room')
            ->orderBy('start_time')
            ->get(['id', 'title', 'room', 'date', 'start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'status'])
            ->filter(fn (Meeting $m) => $m->date->toDateString() === $day->toDateString()
                || \App\Services\RecurrenceService::occursOn($m, $day));

        $result = $rooms->map(function (Room $room) use ($bookings, $day) {
            // Гибкий график зала: рабочие часы по дням недели + праздники.
            // Пустой массив у зала означает «не задан» — нормализуем к дефолту
            // (08:00–20:00 пн–пт), иначе ['start'=>null] давало бы fatal в
            // CarbonImmutable::parse(null) и 500 на всём эндпоинте доступности.
            $raw = $room->schedule;
            $hours = $room->hoursForDateNormalized(
                $day->toDateString(),
                is_array($raw) && !empty($raw) ? $raw : null
            );
            if ($hours === null) {
                // Зал закрыт в эту дату (выходной/праздник): не показываем его
                // в «Свободных залах» вообще — пустые окна только путают.
                return null;
            }
            $dayStart = $hours['start'];
            $dayEnd = $hours['end'];

            $busy = $bookings
                ->where('room', $room->name)
                ->map(fn ($m) => [
                    'meeting_id' => $m->id,
                    'title' => $m->title,
                    'start' => substr((string) $m->start_time, 0, 5),
                    'end' => substr((string) $m->end_time, 0, 5),
                ])->values();

            $free = [];
            $cursor = $dayStart;
            foreach ($busy as $b) {
                if ($b['start'] > $cursor) {
                    $free[] = ['start' => $cursor, 'end' => min($b['start'], $dayEnd)];
                }
                if ($b['end'] > $cursor) {
                    $cursor = $b['end'];
                }
            }
            if ($cursor < $dayEnd) {
                $free[] = ['start' => $cursor, 'end' => $dayEnd];
            }

            return [
                'id' => $room->id,
                'name' => $room->name,
                'capacity' => $room->capacity,
                'busy' => $busy,
                'free' => $free,
                'hours' => $hours,
            ];
        })->filter()->values();

        return $result;
    }

    /**
     * CRUD комнат — только администратор/модератор (роут обёрнут в can:admin-or-moderator).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:rooms,name',
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            // department_id — привязка комнаты к подразделению (RBAC).
            // null / строка названия отдела — публичная комната или отдел по имени.
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            // Гибкий график: {"days":{"mon":{"start":"08:00","end":"20:00"},...},"closed":["2026-11-04"]}
            'schedule' => 'nullable|array',
            'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array',
            'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $room = Room::create($validated);

        return response()->json(['data' => $room], 201);
    }

    public function update(Request $request, Room $room)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:rooms,name,' . $room->id,
            'capacity' => 'nullable|integer|min:1|max:200',
            'location' => 'nullable|string|max:255',
            'department_id' => 'nullable|integer|min:1',
            'equipment' => 'nullable|array',
            'equipment.*' => 'string|max:100',
            'description' => 'nullable|string|max:1000',
            'is_active' => 'nullable|boolean',
            'schedule' => 'nullable|array',
            'schedule.days' => 'nullable|array',
            'schedule.closed' => 'nullable|array',
            'schedule.closed.*' => 'date_format:Y-m-d',
        ]);

        if (array_key_exists('schedule', $validated)) {
            $validated['schedule'] = is_null($validated['schedule']) ? null : Room::normalizeSchedule($validated['schedule']);
        }

        $room->update($validated);

        // График зала влияет на окна «Свободных залов» — сбрасываем кэш доступности.
        \App\Support\MeetingCache::bump();

        return response()->json(['data' => $room]);
    }

    public function destroy(Room $room)
    {
        $room->delete();

        return response()->json(['message' => 'Комната удалена']);
    }
}
