<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class AdminController extends Controller
{
    /**
     * Смена пароля пользователя (только для админов)
     */
    public function resetPassword(Request $request, $id)
    {
        // Проверка что текущий пользователь - админ
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён. Только администраторы могут менять пароли.'], 403);
        }

        // Нельзя менять свой пароль через этот endpoint
        if ($request->user()->id == $id) {
            return response()->json([
                'message' => 'Используйте функцию "Сменить пароль" в своём профиле'
            ], 422);
        }

        $user = User::findOrFail($id);

        $request->validate([
            'password' => [
                'required',
                'string',
                'min:6',
                'confirmed',
            ],
        ]);

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        // Логируем действие
        \Log::info('Admin password reset', [
            'admin_id' => $request->user()->id,
            'admin_email' => $request->user()->email,
            'target_user_id' => $user->id,
            'target_user_email' => $user->email,
            'timestamp' => now()->toIso8601String(),
        ]);

        return response()->json([
            'message' => 'Пароль успешно изменён',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Массовая смена паролей (только для админов)
     */
    public function bulkResetPasswords(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
            'password' => 'required|string|min:6',
        ]);

        // Исключаем текущего пользователя
        $userIds = array_filter($request->user_ids, fn($id) => $id != $request->user()->id);

        if (empty($userIds)) {
            return response()->json([
                'message' => 'Нельзя менять пароль только себе через эту функцию'
            ], 422);
        }

        $hashedPassword = Hash::make($request->password);
        $updatedCount = User::whereIn('id', $userIds)->update(['password' => $hashedPassword]);

        // Логируем действие
        \Log::info('Admin bulk password reset', [
            'admin_id' => $request->user()->id,
            'admin_email' => $request->user()->email,
            'affected_users' => $userIds,
            'count' => $updatedCount,
            'timestamp' => now()->toIso8601String(),
        ]);

        return response()->json([
            'message' => "Пароли изменены для {$updatedCount} пользователей",
            'updated_count' => $updatedCount,
        ]);
    }

    /**
     * Генерация временного пароля
     */
    public function generateTemporaryPassword(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $user = User::findOrFail($id);

        // Генерируем случайный пароль
        $tempPassword = bin2hex(random_bytes(6)); // 12 символов

        $user->update([
            'password' => Hash::make($tempPassword),
        ]);

        // Логируем действие
        \Log::info('Admin generated temporary password', [
            'admin_id' => $request->user()->id,
            'target_user_id' => $user->id,
            'target_user_email' => $user->email,
            'timestamp' => now()->toIso8601String(),
        ]);

        return response()->json([
            'message' => 'Временный пароль сгенерирован',
            'temporary_password' => $tempPassword,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }
}
