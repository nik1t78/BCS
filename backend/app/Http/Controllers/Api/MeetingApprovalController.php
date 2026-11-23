<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MeetingApprovalRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Services\MessengerNotifier;
use Illuminate\Validation\Rule;

class MeetingApprovalController extends Controller
{
    public function index(Request $request)
    {
        $query = MeetingApprovalRequest::with(['requester:id,name,department', 'reviewer:id,name'])
            ->latest();

        if (!$request->user()->isAdminOrModerator()) {
            $query->where('requester_id', $request->user()->id);
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:180',
            'purpose' => 'nullable|string|max:3000',
            'preferred_start' => 'nullable|date|after:now',
            'duration_minutes' => 'required|integer|min:30|max:480',
        ]);

        $item = MeetingApprovalRequest::create($data + [
            'requester_id' => $request->user()->id,
            'status' => 'pending',
        ]);
        AuditLog::log($request, 'approval_requested', $item, [], $item->only(['title', 'status']));
        return response()->json(['data' => $item->load('requester:id,name')], 201);
    }

    public function review(Request $request, MeetingApprovalRequest $approval)
    {
        abort_unless($request->user()->isAdminOrModerator(), 403);
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'review_comment' => 'nullable|string|max:2000',
        ]);
        $reviewed = DB::transaction(function () use ($approval, $data, $request) {
            // Lock the row so two managers cannot approve/reject the same request concurrently.
            $locked = MeetingApprovalRequest::query()->lockForUpdate()->findOrFail($approval->id);
            abort_unless($locked->status === 'pending', 409, 'Заявка уже рассмотрена');

            $old = $locked->only(['status', 'review_comment']);
            $locked->update($data + ['reviewer_id' => $request->user()->id]);
            AuditLog::log($request, 'approval_reviewed', $locked, $old, $locked->only(['status', 'review_comment']));

            return $locked->fresh()->load('requester:id,name', 'reviewer:id,name');
        });

        // Уведомление отправляем только после успешного commit транзакции:
        // иначе пользователь мог получить решение, которое ещё не сохранено.
        MessengerNotifier::notify(
            (int) $reviewed->requester_id,
            $reviewed->meeting_id ? (int) $reviewed->meeting_id : null,
            $reviewed->status === 'approved'
                ? "Заявка «{$reviewed->title}» одобрена."
                : "Заявка «{$reviewed->title}» отклонена.",
            $reviewed->status === 'approved' ? 'info' : 'warning',
            $reviewed->status === 'approved' ? 'Заявка на ВКС одобрена' : 'Заявка на ВКС отклонена'
        );

        return response()->json(['data' => $reviewed]);
    }
}
