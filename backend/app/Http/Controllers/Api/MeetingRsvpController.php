<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Meeting;
use App\Models\MeetingRsvp;
use App\Models\Notification;
use App\Models\User;
use App\Support\CsvCell;
use Illuminate\Http\Request;

class MeetingRsvpController extends Controller
{
    /**
     * Сводка RSVP по конференции (для организатора и участников).
     * GET /api/meetings/{meeting}/rsvp
     */
    public function index(Request $request, Meeting $meeting)
    {
        $user = $request->user();
        $participantIds = array_map('intval', $meeting->participants ?? []);

        if ($meeting->organizer_id !== $user->id && !in_array($user->id, $participantIds, true) && !$user->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $rsvps = $meeting->rsvps()->with('user:id,name')->get()
            ->map(fn ($r) => [
                'user_id' => $r->user_id,
                'name' => optional($r->user)->name,
                'response' => $r->response,
                'responded_at' => $r->responded_at?->toIso8601String(),
            ]);

        return response()->json([
            'rsvps' => $rsvps,
            'summary' => [
                'yes' => $rsvps->where('response', 'yes')->count(),
                'no' => $rsvps->where('response', 'no')->count(),
                'maybe' => $rsvps->where('response', 'maybe')->count(),
                'pending' => max(0, count($participantIds) - $rsvps->count()),
                'total_participants' => count($participantIds),
            ],
            'my_response' => $rsvps->firstWhere('user_id', $user->id)['response'] ?? null,
        ]);
    }


    /**
     * CSV-экспорт ответов и участников без ответа.
     * Доступен только организатору встречи и администратору.
     */
    public function export(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        if ((int) $meeting->organizer_id !== (int) $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Экспорт доступен только организатору или администратору'], 403);
        }

        $participantIds = array_values(array_unique(array_filter(
            array_map('intval', $meeting->participants ?? []),
            fn ($id) => $id > 0
        )));

        $participants = User::query()
            ->whereIn('id', $participantIds)
            ->orderBy('name')
            ->get(['id', 'name', 'login']);

        $rsvps = $meeting->rsvps()->get()->keyBy('user_id');
        $labels = [
            'yes' => 'Придёт',
            'no' => 'Не придёт',
            'maybe' => 'Под вопросом',
        ];

        $filename = 'meeting-' . $meeting->id . '-rsvp-' . now()->format('Ymd-His') . '.csv';

        AuditLog::log($request, 'meeting_rsvp_export', $meeting, null, [
            'participants_count' => $participants->count(),
            'responses_count' => $rsvps->count(),
        ]);

        return response()->streamDownload(function () use ($participants, $rsvps, $labels) {
            $output = fopen('php://output', 'w');
            fwrite($output, "\xEF\xBB\xBF");

            fputcsv($output, ['Участник', 'Логин', 'Ответ', 'Дата ответа'], ';', '"', '');

            foreach ($participants as $participant) {
                $rsvp = $rsvps->get($participant->id);
                $response = $rsvp?->response;

                fputcsv($output, [
                    CsvCell::safe($participant->name),
                    CsvCell::safe($participant->login),
                    $response ? ($labels[$response] ?? 'Неизвестно') : 'Не ответил',
                    $rsvp?->responded_at?->format('d.m.Y H:i') ?? '',
                ], ';', '"', '');
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Ответить на приглашение: yes / no / maybe.
     * POST /api/meetings/{meeting}/rsvp
     */
    public function store(Request $request, Meeting $meeting)
    {
        $user = $request->user();

        $validated = $request->validate([
            'response' => 'required|in:' . implode(',', MeetingRsvp::RESPONSES),
        ]);
        $response = $validated['response'];

        // Организатор присутствует по умолчанию — отвечать не требуется
        if ($meeting->organizer_id === $user->id) {
            return response()->json(['message' => 'Организатор присутствует по умолчанию'], 422);
        }

        $participantIds = array_map('intval', $meeting->participants ?? []);
        if (!in_array($user->id, $participantIds, true)) {
            return response()->json(['message' => 'Вы не являетесь участником этой конференции'], 403);
        }

        if (in_array($meeting->status, ['cancelled', 'completed'], true)) {
            return response()->json(['message' => 'Конференция отменена или завершена'], 422);
        }

        $existing = MeetingRsvp::where('meeting_id', $meeting->id)->where('user_id', $user->id)->first();
        $rsvp = $existing ?? new MeetingRsvp(['meeting_id' => $meeting->id, 'user_id' => $user->id]);
        $old = $existing?->response;
        $rsvp->response = $response;
        $rsvp->responded_at = now();
        $rsvp->save();

        // Уведомляем организатора об ответе (или его изменении)
        $labels = ['yes' => '✅ придёт', 'no' => '❌ не сможет прийти', 'maybe' => '❓ пока под вопросом'];
        Notification::create([
            'user_id' => $meeting->organizer_id,
            'meeting_id' => $meeting->id,
            'message' => "RSVP: {$user->name} {$labels[$response]} на конференцию \"{$meeting->title}\""
                . ($old && $old !== $response ? " (было: {$labels[$old]})" : ''),
            'type' => $response === 'no' ? 'warning' : 'info',
            'read' => false,
        ]);

        AuditLog::log($request, 'meeting_rsvp', $meeting,
            $old ? ['response' => $old] : null,
            ['user_id' => $user->id, 'response' => $response]);

        return response()->json([
            'user_id' => $user->id,
            'response' => $response,
            'responded_at' => $rsvp->responded_at->toIso8601String(),
        ]);
    }
}
