<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Список пользователей (admin/moderator)
     */
    public function index(Request $request)
    {
        if (!$request->user()->isAdminOrModerator()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $query = User::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('login', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        $users = $query->orderBy('name')->paginate($request->get('per_page', 50));

        return response()->json($users);
    }

    /**
     * Создание пользователя (admin)
     */
    public function store(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'login' => 'required|string|unique:users',
            'password' => 'required|min:6',
            'role' => 'required|in:admin,moderator,user',
            'phone' => 'nullable|string|max:20',
            'department' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'is_active' => 'boolean',
        ]);

        // Каст 'password' => 'hashed' в модели сам выполнит хеширование
        $user = User::create($validated);

        return response()->json($user, 201);
    }

    /**
     * Получить пользователя
     */
    public function show(Request $request, $id)
    {
        if (!$request->user()->isAdminOrModerator()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $user = User::findOrFail($id);
        return response()->json($user);
    }

    /**
     * Обновление пользователя
     */
    public function update(Request $request, $id)
    {
        $currentUser = $request->user();
        $user = User::findOrFail($id);

        // Пользователь может обновлять только свой профиль
        if ($user->id !== $currentUser->id && !$currentUser->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'login' => 'sometimes|string|unique:users,login,' . $id,
            'phone' => 'nullable|string|max:20',
            'department' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
        ]);

        $user->update($validated);

        return response()->json($user);
    }

    /**
     * Обновление профиля текущего пользователя
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'login' => 'sometimes|string|unique:users,login,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'department' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
        ]);

        $user->update($validated);

        return response()->json($user);
    }

    /**
     * Смена пароля
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'password' => 'required|min:6|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Неверный текущий пароль'], 422);
        }

        // Каст 'password' => 'hashed' в модели сам выполнит хеширование
        $user->update(['password' => $request->password]);

        return response()->json(['message' => 'Пароль изменён']);
    }

    /**
     * Удаление пользователя (admin)
     */
    public function destroy(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ($id == $request->user()->id) {
            return response()->json(['message' => 'Нельзя удалить свой аккаунт'], 422);
        }

        $user = User::findOrFail($id);
        $user->delete();

        return response()->json(['message' => 'Пользователь удалён']);
    }

    /**
     * Изменение роли (admin)
     */
    public function changeRole(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $request->validate([
            'role' => 'required|in:admin,moderator,user',
        ]);

        $user = User::findOrFail($id);
        $user->update(['role' => $request->role]);

        return response()->json($user);
    }

    /**
     * Блокировка/разблокировка (admin/moderator)
     */
    public function toggleActive(Request $request, $id)
    {
        if (!$request->user()->isAdminOrModerator()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ($id == $request->user()->id) {
            return response()->json(['message' => 'Нельзя заблокировать свой аккаунт'], 422);
        }

        $user = User::findOrFail($id);
        $user->update(['is_active' => !$user->is_active]);

        return response()->json($user);
    }

    /**
     * Получить настройки
     */
    public function getSettings(Request $request)
    {
        return response()->json($request->user()->getSettings());
    }

    /**
     * Обновить настройки
     */
    public function updateSettings(Request $request)
    {
        $settings = $request->user()->getSettings();

        $validated = $request->validate([
            'sound_enabled' => 'boolean',
            'browser_notifications' => 'boolean',
            'default_reminder_minutes' => 'integer|min:5|max:1440',
            'work_hours_start' => 'date_format:H:i',
            'work_hours_end' => 'date_format:H:i',
            'timezone' => 'string|max:50',
        ]);

        $settings->update($validated);

        return response()->json($settings);
    }

    /**
     * Статистика (admin)
     */
    public function getStats(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('is_active', true)->count(),
            'admins' => User::where('role', 'admin')->count(),
            'moderators' => User::where('role', 'moderator')->count(),
            'users' => User::where('role', 'user')->count(),
            'new_this_month' => User::whereMonth('created_at', now()->month)->count(),
        ]);
    }
}
