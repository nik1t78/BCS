<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MeetingTemplate;
use Illuminate\Http\Request;

class TemplateController extends Controller
{
    public function index(Request $request)
    {
        $templates = MeetingTemplate::where('user_id', $request->user()->id)->get();
        return response()->json($templates);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:5|max:480',
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'priority' => 'required|in:low,medium,high',
            'reminder_minutes' => 'nullable|integer|min:5|max:1440',
            'recurring' => 'required|in:none,daily,weekly,monthly',
            'is_private' => 'boolean',
        ]);

        // Напоминание раньше 5 минут бэкенд не принимает (min:5) — из-за
        // этого создание шаблона падало с 422. Значение по умолчанию — 5.
        $reminderMinutes = (int) ($request->input('reminder_minutes') ?? 5);
        if ($reminderMinutes < 5) {
            $reminderMinutes = 5;
        }

        $template = MeetingTemplate::create([
            'user_id' => $request->user()->id,
            'name' => $request->name,
            'description' => $request->description,
            'duration_minutes' => $request->duration_minutes ?? 60,
            'room' => $request->room,
            'link' => $request->link,
            'priority' => $request->priority,
            'reminder_minutes' => min($reminderMinutes, 1440),
            'recurring' => $request->recurring,
            'is_private' => $request->is_private ?? false,
            'default_participants' => $request->default_participants ?? [],
        ]);

        return response()->json($template, 201);
    }

    public function update(Request $request, $id)
    {
        $template = MeetingTemplate::findOrFail($id);

        if ($template->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'duration_minutes' => 'nullable|integer|min:5|max:480',
            'room' => 'nullable|string|max:255',
            'link' => 'nullable|url|max:500',
            'priority' => 'sometimes|in:low,medium,high',
            'reminder_minutes' => 'nullable|integer|min:5|max:1440',
            'recurring' => 'sometimes|in:none,daily,weekly,monthly',
            'is_private' => 'boolean',
        ]);

        $template->update($request->only([
            'name', 'description', 'duration_minutes', 'room', 'link',
            'priority', 'reminder_minutes', 'recurring', 'is_private', 'default_participants'
        ]));

        return response()->json($template);
    }

    public function destroy(Request $request, $id)
    {
        $template = MeetingTemplate::findOrFail($id);

        if ($template->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $template->delete();

        return response()->json(['message' => 'Шаблон удалён']);
    }
}
