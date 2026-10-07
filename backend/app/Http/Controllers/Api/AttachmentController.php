<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttachmentController extends Controller
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

        $attachments = Attachment::where('meeting_id', $meetingId)->get();
        return response()->json($attachments);
    }

    public function store(Request $request, $meetingId)
    {
        $meeting = Meeting::findOrFail($meetingId);

        // Проверка доступа
        if ($meeting->organizer_id !== $request->user()->id && 
            !in_array($request->user()->id, $meeting->participants ?? [])) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $request->validate([
            'file' => 'required|file|max:10240', // 10MB
        ]);

        $file = $request->file('file');
        $path = $file->store('attachments/' . $meetingId, 'public');

        $attachment = Attachment::create([
            'meeting_id' => $meetingId,
            'user_id' => $request->user()->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ]);

        return response()->json($attachment, 201);
    }

    public function destroy(Request $request, $id)
    {
        $attachment = Attachment::findOrFail($id);

        // Проверка доступа
        if ($attachment->user_id !== $request->user()->id) {
            $meeting = Meeting::find($attachment->meeting_id);
            if ($meeting->organizer_id !== $request->user()->id) {
                return response()->json(['message' => 'Доступ запрещён'], 403);
            }
        }

        // Удаляем файл из хранилища
        Storage::disk('public')->delete($attachment->file_path);

        $attachment->delete();

        return response()->json(['message' => 'Файл удалён']);
    }
}
