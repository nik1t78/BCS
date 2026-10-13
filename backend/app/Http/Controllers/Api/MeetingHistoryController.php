<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MeetingHistory;
use App\Models\Meeting;
use Illuminate\Http\Request;

class MeetingHistoryController extends Controller
{
    public function index(Request $request, $meetingId)
    {
        $meeting = Meeting::findOrFail($meetingId);

        // Проверка доступа
        if ($meeting->is_private && 
            $meeting->organizer_id !== $request->user()->id && 
            !in_array($request->user()->id, $meeting->participants ?? [])) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $history = MeetingHistory::where('meeting_id', $meetingId)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($history);
    }
}
