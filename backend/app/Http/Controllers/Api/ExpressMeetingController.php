<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Пункты 8 + 4 плана: API для телевизора/QR без полноценного UI.
 *
 *  - POST /api/express-meeting  — «Забронировать экспресс на 30 мин» одним
 *    кликом: создаёт встречу в указанном свободном зале прямо сейчас,
 *    ВКС-ссылку автопилот/очередь генерирует асинхронно (VKSBOT_AUTO).
 *  - GET  /api/meetings/{meeting}/qr — PNG QR-кода «вечной» ссылки /m/{id}
 *    (для экрана ТВ и печати). Генератор — лёгкий self-contained (без composer-пакетов).
 */
class ExpressMeetingController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'room' => 'required|string|max:255',
            'minutes' => 'nullable|integer|min:10|max:480',
            'title' => 'nullable|string|max:255',
        ]);

        $minutes = (int) ($validated['minutes'] ?? 30);
        $user = $request->user();

        // Окно «сейчас + 5 мин» (запас на дорогу до зала), конец = +minutes.
        $now = now()->addMinutes(5);
        $startHM = $now->format('H:i');
        $end = $now->copy()->addMinutes($minutes);
        // Не позже конца рабочего дня 20:00 (как в виджете свободных залов).
        if ((int) $end->format('H') >= 20) {
            $end = $now->setTime(19, 59);
        }
        $endHM = $end->format('H:i');

        // Занятость зала (точные встречи + occurrence'ы серий) — как в RoomController.
        $conflict = Meeting::query()
            ->where('room', $validated['room'])
            ->whereIn('status', ['scheduled', 'in-progress'])
            ->whereDate('date', $now->toDateString())
            ->get(['start_time', 'end_time', 'recurring', 'repeat_until', 'rrule', 'date'])
            ->contains(fn (Meeting $m) => \App\Services\RecurrenceService::occursOn($m, $now) &&
                substr((string) $m->start_time, 0, 5) < $endHM &&
                substr((string) $m->end_time, 0, 5) > $startHM);

        if ($conflict) {
            return response()->json(['message' => 'Зал занят в это время — выберите другое окно'], 422);
        }

        $meeting = Meeting::create([
            'title' => $validated['title'] ?? ('Экспресс · ' . $minutes . ' мин'),
            'description' => null,
            'date' => $now->toDateString(),
            'start_time' => $startHM,
            'end_time' => $endHM,
            'organizer_id' => $user->id,
            'participants' => [$user->id],
            'room' => $validated['room'],
            'status' => 'scheduled',
            'priority' => 'medium',
            'recurring' => 'none',
        ]);

        try {
            if (filter_var(env('VKSBOT_AUTO', false), FILTER_VALIDATE_BOOLEAN)) {
                \App\Jobs\CreateVksLinkJob::dispatch($meeting->id);
            }
        } catch (\Throwable $e) {
            report($e);
        }

        \App\Support\SafeCache::forever('meetings:changed', now()->timestamp);

        return response()->json($meeting->load(['organizer']), 201);
    }

    /**
     * QR-код «вечной» ссылки /m/{id}: участник сканирует телефоном и попадает
     * на редирект, который всегда ведёт на актуальную комнату ВКС.
     */
    public function qr(Request $request, int $meeting)
    {
        $m = Meeting::accessibleBy($request->user())->find($meeting);
        if (!$m) {
            return response()->json(['message' => 'Не найдено'], 404);
        }

        // QR ведёт на «вечную» ссылку /api/m/{id} — она всегда редиректит на
        // актуальную комнату, даже если автопилот пересоздал её после QR-печати.
        $url = rtrim(config('app.url', $request->getSchemeAndHttpHost()), '/') . '/api/m/' . $m->id;

        // Генерация QR: сначала лёгкий self-contained генератор (без composer-пакетов,
        // работает на «голом» php-gd). Если установлен chillerlan/php-qrcode — берём его.
        $png = Cache::remember('qr_' . md5($url), now()->addDay(), function () use ($url) {
            try {
                if (class_exists(\chillerlan\QRCode\QRCode::class)) {
                    return (new \chillerlan\QRCode\QRCode())
                        ->render(\chillerlan\QRCode\QRCode::OUTPUT_IMAGE_PNG, $url);
                }
            } catch (\Throwable $e) {
                report($e);
            }
            return \App\Support\QrPng::generate($url);
        });

        if (!$png) {
            return response()->json(['message' => 'Не удалось построить QR'], 500);
        }

        return response($png, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
