<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TemplateController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\MeetingHistoryController;
use App\Http\Controllers\Api\MeetingMinuteController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Публичные маршруты (с rate limiting: общий лимит + жёсткий на подбор пароля)
Route::middleware('throttle:api')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/refresh', [AuthController::class, 'refresh'])->middleware('throttle:login');
});

// Health check
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'version' => '1.0.0',
    ]);
});

// Защищённые маршруты
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/logout-all', [AuthController::class, 'logoutAll']);
    Route::get('/auth/sessions', [AuthController::class, 'sessions']);
    Route::get('/auth/user', [AuthController::class, 'user']);

    // Profile
    Route::put('/profile', [UserController::class, 'updateProfile']);
    Route::post('/profile/change-password', [UserController::class, 'changePassword']);

    // Публичный справочник пользователей (ФИО для календаря/карточек) —
    // доступен любому авторизованному, права админа не требуются
    Route::get('/users', [UserController::class, 'publicList']);

    // Meetings
    Route::apiResource('meetings', MeetingController::class);
    Route::get('/meetings-stats', [MeetingController::class, 'getStats']);

    // Проверка конфликтов расписания (пересечения по времени у одних и тех же людей)
    Route::get('/meetings/check-conflicts', [\App\Http\Controllers\Api\ScheduleConflictController::class, 'check']);

    // Корзина мягко удалённых встреч
    Route::get('/trash', [\App\Http\Controllers\Api\MeetingTrashController::class, 'index']);
    Route::post('/trash/{id}/restore', [\App\Http\Controllers\Api\MeetingTrashController::class, 'restore']);
    Route::delete('/trash/{id}', [\App\Http\Controllers\Api\MeetingTrashController::class, 'destroyForever']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/clear', [NotificationController::class, 'clearAll']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);

    // Realtime-канал уведомлений (Server-Sent Events). Отдельный лимит:
    // это долгоживущее соединение, его throttle не должен считать каждый heartbeat.
    Route::middleware('throttle:10,1')->get('/notifications/stream', [\App\Http\Controllers\Api\NotificationStreamController::class, 'stream']);

    // Settings
    Route::get('/settings', [UserController::class, 'getSettings']);
    Route::put('/settings', [UserController::class, 'updateSettings']);

    // Tags
    Route::get('/tags', [TagController::class, 'index']);
    Route::post('/tags', [TagController::class, 'store']);
    Route::put('/tags/{id}', [TagController::class, 'update']);
    Route::delete('/tags/{id}', [TagController::class, 'destroy']);

    // Templates
    Route::get('/templates', [TemplateController::class, 'index']);
    Route::post('/templates', [TemplateController::class, 'store']);
    Route::put('/templates/{id}', [TemplateController::class, 'update']);
    Route::delete('/templates/{id}', [TemplateController::class, 'destroy']);

    // Attachments
    Route::get('/meetings/{meetingId}/attachments', [AttachmentController::class, 'index']);
    Route::post('/meetings/{meetingId}/attachments', [AttachmentController::class, 'store']);
    Route::delete('/attachments/{id}', [AttachmentController::class, 'destroy']);

    // Meeting History
    Route::get('/meetings/{meetingId}/history', [MeetingHistoryController::class, 'index']);

    // Протокол встречи (minutes) и задачи/action items
    Route::get('/meetings/{meeting}/minutes', [MeetingMinuteController::class, 'minutesIndex']);
    Route::post('/meetings/{meeting}/minutes', [MeetingMinuteController::class, 'minutesStore']);
    Route::put('/meetings/{meeting}/minutes/{minute}', [MeetingMinuteController::class, 'minutesUpdate']);
    Route::delete('/meetings/{meeting}/minutes/{minute}', [MeetingMinuteController::class, 'minutesDestroy']);

    Route::get('/meetings/{meeting}/tasks', [MeetingMinuteController::class, 'tasksIndex']);
    Route::post('/meetings/{meeting}/tasks', [MeetingMinuteController::class, 'tasksStore']);
    Route::put('/meetings/{meeting}/tasks/{task}', [MeetingMinuteController::class, 'tasksUpdate']);
    Route::delete('/meetings/{meeting}/tasks/{task}', [MeetingMinuteController::class, 'tasksDestroy']);

    // Комментарии к задачам (action items)
    Route::post('/meetings/{meeting}/tasks/{task}/comments', [MeetingMinuteController::class, 'taskCommentStore']);
    Route::delete('/meetings/{meeting}/tasks/{task}/comments/{comment}', [MeetingMinuteController::class, 'taskCommentDestroy']);

    // Отмена встречи с уведомлением участников / перенос (drag&drop в Schedule)
    Route::post('/meetings/{meeting}/cancel', [MeetingController::class, 'cancel']);
    Route::put('/meetings/{meeting}/reschedule', [MeetingController::class, 'reschedule']);

    // RSVP: подтверждение присутствия участником + сводка для организатора
    Route::get('/meetings/{meeting}/rsvp', [\App\Http\Controllers\Api\MeetingRsvpController::class, 'index']);
    Route::post('/meetings/{meeting}/rsvp', [\App\Http\Controllers\Api\MeetingRsvpController::class, 'store']);

    // Переговорные комнаты: справочник и доступность (бронирование через поле room встречи)
    Route::get('/rooms', [\App\Http\Controllers\Api\RoomController::class, 'index']);
    Route::get('/rooms/{room}/availability', [\App\Http\Controllers\Api\RoomController::class, 'availability']);

    // Интеграция с мессенджером MAX (max.ru): deep-link на чат бота для уведомлений
    Route::get('/max/status', function (\Illuminate\Http\Request $request) {
        return response()->json([
            'enabled' => filter_var(env('MAX_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
            'botLink' => env('MAX_BOT_LINK', 'https://max.ru/id0000000000_bot'),
            'linkedChatId' => $request->user()->max_chat_id,
        ]);
    });
    Route::put('/max/link', function (\Illuminate\Http\Request $request) {
        $validated = $request->validate(['chat_id' => 'required|string|max:100']);
        $request->user()->update(['max_chat_id' => $validated['chat_id']]);
        return response()->json(['message' => 'Аккаунт MAX привязан']);
    });
    Route::delete('/max/link', function (\Illuminate\Http\Request $request) {
        $request->user()->update(['max_chat_id' => null]);
        return response()->json(['message' => 'Привязка MAX удалена']);
    });

    // Admin routes (admin + moderator)
    Route::middleware('can:admin-or-moderator')->group(function () {
        Route::post('/rooms', [\App\Http\Controllers\Api\RoomController::class, 'store']);
        Route::put('/rooms/{room}', [\App\Http\Controllers\Api\RoomController::class, 'update']);
        Route::delete('/rooms/{room}', [\App\Http\Controllers\Api\RoomController::class, 'destroy']);

        Route::get('/admin/users', [UserController::class, 'index']);
        Route::get('/admin/users/{id}', [UserController::class, 'show']);
        Route::put('/admin/users/{id}', [UserController::class, 'update']);
        Route::put('/admin/users/{id}/toggle-active', [UserController::class, 'toggleActive']);
    });

    // Admin only routes
    Route::middleware('can:admin')->group(function () {
        Route::post('/admin/users', [UserController::class, 'store']);
        Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);
        Route::put('/admin/users/{id}/role', [UserController::class, 'changeRole']);
        Route::get('/admin/stats', [UserController::class, 'getStats']);
        Route::get('/admin/heatmap', [\App\Http\Controllers\Api\AnalyticsController::class, 'heatmap']);

        // Аудит-лог действий пользователей (только администратор)
        Route::get('/admin/audit-logs', [\App\Http\Controllers\Api\AuditLogController::class, 'index']);
        Route::get('/admin/audit-logs/export', [\App\Http\Controllers\Api\AuditLogController::class, 'export']);
        
        // Password management
        Route::put('/admin/users/{id}/reset-password', [\App\Http\Controllers\Api\AdminController::class, 'resetPassword']);
        Route::post('/admin/users/bulk-reset-passwords', [\App\Http\Controllers\Api\AdminController::class, 'bulkResetPasswords']);
        Route::post('/admin/users/{id}/generate-temporary-password', [\App\Http\Controllers\Api\AdminController::class, 'generateTemporaryPassword']);
    });
});

// Fallback для SPA
Route::get('/{any}', function () {
    return response()->json(['message' => 'Not found'], 404);
})->where('any', '.*');
