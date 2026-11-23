<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\Meeting;
use App\Models\UserSetting;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

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
     * Публичный справочник пользователей (для любого авторизованного).
     * Нужен календарю, карточкам конференций и выбору участников, чтобы
     * показывать ФИО организатора/участников. Возвращает только безопасные
     * поля (id, name, login, department, position, isActive).
     */
    public function publicList(Request $request)
    {
        return response()->json(
            User::query()
                ->select('id', 'name', 'login', 'department', 'position', 'is_active')
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
        );
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
            'avatar' => 'nullable|string|max:3000000',
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

        // Каст 'password' => 'hashed' в модели сам выполнит хеширование.
        // Смена пароля пользователем снимает флаг обязательной смены при первом входе.
        $user->update([
            'password' => $request->password,
            'must_change_password' => false,
        ]);

        AuditLog::log($request, 'password_changed', $user);

        return response()->json(['message' => 'Пароль изменён']);
    }

    /**
     * Удаление пользователя (admin)
     *
     * Ранее удалялся только сам пользователь, из-за чего MySQL/MariaDB
     * отклонял DELETE при наличии связанных записей (FOREIGN_KEY_CONSTRAINT_VIOLATION):
     *   - personal_access_tokens (morph-связь, каскад по id не срабатывает);
     *   - audit_logs.user_id — в старых миграциях FK был без "set null",
     *     поэтому удаление пользователя, совершавшего действия, падало с 500.
     * Теперь в транзакции сначала чистятся зависимые записи токенов, а записи
     * аудита отвязываются (user_id = NULL), после чего пользователь удаляется.
     */
    public function destroy(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        if ((int) $id === (int) $request->user()->id) {
            return response()->json(['message' => 'Нельзя удалить свой аккаунт'], 422);
        }

        try {
        $result = DB::transaction(function () use ($id, $request) {
                $user = User::query()->whereKey($id)->lockForUpdate()->firstOrFail();
                $activeAdmins = User::query()
                    ->where('role', 'admin')
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->get(['id']);
    
                $hasMeetingHistory = Meeting::withTrashed()
                    ->where(function ($query) use ($user) {
                        $query->where('organizer_id', $user->id)
                            ->orWhereJsonContains('participants', (int) $user->id);
                    })
                    ->exists();
    
                if (!\App\Support\UserAdministrationPolicy::canDelete($hasMeetingHistory)) {
                    return ['error' => 'У пользователя есть встречи или история участия. Не удаляйте аккаунт: отключите его, чтобы сохранить историю.', 'status' => 409];
                }
    
                if (!\App\Support\UserAdministrationPolicy::canRemoveActiveAdmin(
                    $user->role,
                    (bool) $user->is_active,
                    $activeAdmins->count()
                )) {
                    return ['error' => 'Нельзя удалить последнего активного администратора системы.', 'status' => 409];
                }
    
                DB::table('personal_access_tokens')
                    ->where('tokenable_type', get_class($user))
                    ->where('tokenable_id', $user->id)
                    ->delete();
    
                if (Schema::hasColumn('audit_logs', 'user_id')) {
                    DB::table('audit_logs')
                        ->where('user_id', $user->id)
                        ->update(['user_id' => null]);
                }
    
                $deleted = ['name' => $user->name, 'login' => $user->login];
                $user->delete();
    
                return ['error' => null, 'deleted' => $deleted];
            });
        } catch (QueryException $e) {
            \\Log::error('User delete failed due to related records', [
                'target_user_id' => $id,
                'sql_state' => $e->getCode(),
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Не удалось удалить пользователя из-за связанных данных. Аккаунт и история сохранены; отключите пользователя вместо удаления.',
            ], 409);
        }

        if ($result['error'] !== null) {
            return response()->json(['message' => $result['error']], $result['status']);
        }

        AuditLog::log($request, 'user_deleted', null, $result['deleted']);

        return response()->json(['message' => 'Пользователь удалён']);
    }
    public function changeRole(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['message' => 'Доступ запрещён'], 403);
        }

        $validated = $request->validate([
            'role' => 'required|in:admin,moderator,user',
        ]);

        $result = DB::transaction(function () use ($id, $validated) {
            $user = User::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $oldRole = $user->role;
            $activeAdmins = User::query()
                ->where('role', 'admin')
                ->where('is_active', true)
                ->lockForUpdate()
                ->get(['id']);

            if ($oldRole !== $validated['role']
                && !\App\Support\UserAdministrationPolicy::canRemoveActiveAdmin(
                    $oldRole,
                    (bool) $user->is_active,
                    $activeAdmins->count()
                )
                && $validated['role'] !== 'admin') {
                return ['blocked' => true, 'message' => 'Нельзя снять роль у последнего активного администратора. Сначала назначьте другого администратора.'];
            }

            $user->update(['role' => $validated['role']]);

            return ['blocked' => false, 'user' => $user, 'old_role' => $oldRole];
        });

        if ($result['blocked']) {
            return response()->json(['message' => $result['message']], 409);
        }

        if ($result['old_role'] !== $validated['role']) {
            AuditLog::log($request, 'user_role_changed', $result['user'], ['role' => $result['old_role']], ['role' => $validated['role']]);
        }

        return response()->json($result['user']);
    }
    public function toggleActive(Request $request, $id)
    {
        $actor = $request->user();

        if ((int) $id === (int) $actor->id) {
            return response()->json(['message' => 'Нельзя заблокировать свой аккаунт'], 422);
        }

        $result = DB::transaction(function () use ($actor, $id) {
            $user = User::query()->whereKey($id)->lockForUpdate()->firstOrFail();

            if (!\App\Support\UserAdministrationPolicy::canToggleActive(
                (string) $actor->role,
                (string) $user->role,
                (int) $actor->id,
                (int) $user->id
            )) {
                return ['forbidden' => true];
            }

            $activeAdmins = User::query()
                ->where('role', 'admin')
                ->where('is_active', true)
                ->lockForUpdate()
                ->get(['id']);

            if ($user->is_active && !\App\Support\UserAdministrationPolicy::canRemoveActiveAdmin(
                (string) $user->role,
                true,
                $activeAdmins->count()
            )) {
                return ['last_admin' => true];
            }

            $user->update(['is_active' => !$user->is_active]);

            return ['user' => $user];
        });

        if (!empty($result['forbidden'])) {
            return response()->json(['message' => 'Модератор может блокировать только обычных пользователей.'], 403);
        }

        if (!empty($result['last_admin'])) {
            return response()->json(['message' => 'Нельзя отключить последнего активного администратора системы.'], 409);
        }

        $user = $result['user'];
        AuditLog::log($request, $user->is_active ? 'user_unblocked' : 'user_blocked', $user);

        return response()->json($user);
    }
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
            // Продуктовая аналитика (журнал user_activity, см. middleware TrackActivity).
            // Таблица появляется после php artisan migrate — до этого отдаём нули.
            ...$this->engagementStats(),
        ]);
    }

    /** DAU/MAU и тренд за 14 дней из daily_stats/user_activity */
    private function engagementStats(): array
    {
        try {
            if (!\Illuminate\Support\Facades\DB::getSchemaBuilder()->hasTable('daily_stats')) {
                return ['dau' => null, 'mau' => null, 'trend' => []];
            }
            $today = \Illuminate\Support\Facades\DB::table('daily_stats')->where('date', now()->toDateString())->first();
            $trend = \Illuminate\Support\Facades\DB::table('daily_stats')
                ->where('date', '>=', now()->subDays(13)->toDateString())
                ->orderBy('date')
                ->get(['date', 'dau', 'mau', 'actions']);
            return [
                'dau' => $today?->dau,
                'mau' => $today?->mau,
                'trend' => $trend,
            ];
        } catch (\Throwable $e) {
            return ['dau' => null, 'mau' => null, 'trend' => []];
        }
    }
}
