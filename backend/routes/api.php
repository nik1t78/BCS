<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TemplateController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\MeetingHistoryController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Публичные маршруты
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Health check
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'version' => '1.0.0',
    ]);
});

// Защищённые маршруты
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
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

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/clear', [NotificationController::class, 'clearAll']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);

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

    // Admin routes (admin + moderator)
    Route::middleware('can:admin-or-moderator')->group(function () {
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
