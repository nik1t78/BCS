<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AttachmentController extends Controller
{
    public function index(Request $request, $meetingId)
    {
        $meeting = Meeting::findOrFail($meetingId);
        $user = $request->user();

        if (!$meeting->hasAccess($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $attachments = Attachment::where('meeting_id', $meetingId)
            ->latest('id')
            ->get()
            ->map(fn (Attachment $attachment) => [
                'id' => $attachment->id,
                'meeting_id' => $attachment->meeting_id,
                'user_id' => $attachment->user_id,
                'file_name' => $attachment->file_name,
                'file_path' => $attachment->file_path,
                'file_size' => $attachment->file_size,
                'mime_type' => $attachment->mime_type,
                'created_at' => $attachment->created_at,
                'download_url' => url('/api/attachments/' . $attachment->id . '/download'),
            ]);

        return response()->json($attachments);
    }

    public function store(Request $request, $meetingId)
    {
        $meeting = Meeting::findOrFail($meetingId);
        $user = $request->user();

        $isMember = $meeting->isOrganizer($user->id)
            || in_array((int) $user->id, array_map('intval', $meeting->participants ?? []), true);

        if (!$meeting->hasAccess($user) || (!$isMember && !$user->isAdmin())) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $request->validate([
            'file' => [
                'required',
                'file',
                'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png',
            ],
        ]);

        $file = $request->file('file');
        $path = $file->store('attachments/' . $meetingId, 'public');

        $originalName = str_replace('\\', '/', (string) $file->getClientOriginalName());
        $safeName = basename($originalName);
        $safeName = preg_replace('/[\x00-\x1F\x7F]/u', '', $safeName) ?: 'attachment';
        $safeName = mb_substr($safeName, 0, 240);

        $attachment = Attachment::create([
            'meeting_id' => $meetingId,
            'user_id' => $user->id,
            'file_name' => $safeName,
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
        ]);

        return response()->json([
            'id' => $attachment->id,
            'meeting_id' => $attachment->meeting_id,
            'user_id' => $attachment->user_id,
            'file_name' => $attachment->file_name,
            'file_path' => $attachment->file_path,
            'file_size' => $attachment->file_size,
            'mime_type' => $attachment->mime_type,
            'created_at' => $attachment->created_at,
            'download_url' => url('/api/attachments/' . $attachment->id . '/download'),
        ], 201);
    }

    public function download(Request $request, $id)
    {
        $attachment = Attachment::findOrFail($id);
        $meeting = Meeting::findOrFail($attachment->meeting_id);

        if (!$meeting->hasAccess($request->user())) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        // Файлы вложений не отдаются напрямую из публичного /storage.
        // Допускаем только собственный каталог вложений.
        if (!Str::startsWith((string) $attachment->file_path, 'attachments/')) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        $disk = Storage::disk('public');
        if (!$disk->exists($attachment->file_path)) {
            return response()->json(['message' => 'Файл не найден'], 404);
        }

        $name = str_replace(["\r", "\n", '"'], '', (string) $attachment->file_name);
        return $disk->download($attachment->file_path, $name, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $attachment = Attachment::findOrFail($id);
        $meeting = Meeting::findOrFail($attachment->meeting_id);
        $user = $request->user();

        if (!$meeting->hasAccess($user)) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if (
            (int) $attachment->user_id !== (int) $user->id
            && !$meeting->isOrganizer($user->id)
            && !$user->isAdmin()
        ) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'Файл удалён']);
    }
}
