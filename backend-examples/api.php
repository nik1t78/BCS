<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MeetingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\NotificationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Маршруты API для системы ВКС Расписание
|
*/

// Публичные маршруты (без авторизации)
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Защищённые маршруты (требуют авторизации)
Route::middleware('auth:sanctum')->group(function () {
    
    // Авторизация
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    
    // Профиль пользователя
    Route::put('/profile', [UserController::class, 'updateProfile']);
    Route::post('/profile/change-password', [UserController::class, 'changePassword']);
    
    // Конференции
    Route::apiResource('meetings', MeetingController::class);
    
    // Уведомления
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/clear', [NotificationController::class, 'clearAll']);
    
    // Настройки
    Route::get('/settings', [UserController::class, 'getSettings']);
    Route::put('/settings', [UserController::class, 'updateSettings']);
    
    // Админ-панель (только для админов и модераторов)
    Route::middleware('role:admin,moderator')->group(function () {
        
        // Управление пользователями
        Route::get('/admin/users', [UserController::class, 'index']);
        Route::post('/admin/users', [UserController::class, 'store']);
        Route::get('/admin/users/{id}', [UserController::class, 'show']);
        Route::put('/admin/users/{id}', [UserController::class, 'update']);
        Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);
        Route::put('/admin/users/{id}/role', [UserController::class, 'changeRole']);
        Route::put('/admin/users/{id}/toggle-active', [UserController::class, 'toggleActive']);
        
        // Статистика
        Route::get('/admin/stats', [UserController::class, 'getStats']);
        Route::get('/admin/stats/meetings', [MeetingController::class, 'getStats']);
    });
    
    // Только для админов
    Route::middleware('role:admin')->group(function () {
        Route::delete('/admin/users/{id}/force', [UserController::class, 'forceDelete']);
        Route::post('/admin/users/import', [UserController::class, 'import']);
        Route::get('/admin/users/export', [UserController::class, 'export']);
    });
});

// Health check
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
        'version' => config('app.version', '1.0.0'),
    ]);
});
