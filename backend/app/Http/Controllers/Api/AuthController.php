<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Регистрация нового пользователя
     */
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'login' => 'required|string|max:255|unique:users',
            // Регистрируемся без поля подтверждения (пароль отправляется один раз),
            // требования к паролю совпадают с фронтендом: минимум 6 символов.
            'password' => ['required', 'string', 'min:6'],
            'phone' => 'nullable|string|max:20',
            'department' => 'nullable|string|max:255',
        ]);

        // В модели User включён каст 'password' => 'hashed', поэтому передаём
        // пароль как есть: двойное хеширование (Hash::make поверх зашифрованного
        // значения) ломало проверку пароля при входе.
        $user = User::create([
            'name' => $request->name,
            'login' => $request->login,
            'password' => $request->password,
            'phone' => $request->phone,
            'department' => $request->department,
            'role' => 'user',
            'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    /**
     * Проверка пароля.
     *
     * Исторический баг: старые версии кода записывали в БД Hash::make($plain),
     * поверх которого каст модели 'password' => 'hashed' хешировал ещё раз
     * (двойной bcrypt-хэш). Такой хэш криптографически непроверяем — вход
     * падал с 422 даже при верном пароле. Лечится перезаписью паролей:
     * php artisan vks:reset-passwords (или db:seed VksDatabaseSeeder).
     *
     * Производительность: на слабых/VPS-серверах один bcrypt-хеш может быть
     * выставлен с завышенным «cost» ($2y$12… и выше) — проверка такого хеша
     * занимает секунды, и пользователь видит «сайт долго логает». Если хеш
     * корректный, но слишком тяжёлый, пересчитываем его до стандартного
     * cost=10 и сохраняем: следующий вход будет мгновенным.
     */
    private function verifyPassword(User $user, string $plain): bool
    {
        if (!Hash::check($plain, $user->password)) {
            return false;
        }

        try {
            $cost = (int) (explode('$', (string) $user->password)[2] ?? 10);
            if ($cost > 10 || Hash::needsRehash($user->password)) {
                // Каст 'password' => 'hashed' в модели User защитит от
                // двойного хеширования: кладём в БД ровно один новый bcrypt.
                $user->forceFill(['password' => $plain])->saveQuietly();
            }
        } catch (\Throwable $e) {
            // авто-ренеш не должен ломать успешный вход
        }

        return true;
    }

    /**
     * Вход в систему
     */
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        // Логин регистронезависимый: "Admin" и "admin" — один аккаунт.
        // Иначе пользователь, случайно набравший CapsLock, получает
        // «Неверный логин или пароль» даже при правильном пароле.
        $user = User::whereRaw('LOWER(login) = ?', [mb_strtolower(trim($request->login))])->first();

        // Гигиена токенов: каждое создание токена Sanctum выполняет SELECT с
        // LIKE 'refresh_token:%' по всей таблице personal_access_tokens (без
        // индекса по name). Со временем таблица разрастается «мусором»:
        // истёкшие access-токены и неиспользованные refresh-токены (у каждого
        // входа их пара, а старые аннулируются только при refresh/logout).
        // Удаляем их в фоне (registerShutdownFunction — НЕ блокирует ответ,
        // nginx уже отправит клиенту 200 до того, как начнётся DELETE): иначе
        // именно этот запрос превращал каждый вход в «сайт долго логает».
        //
        // ВАЖНО: раньше здесь использовался Queue::afterResponse(). В Laravel
        // 11+ фасад Queue больше не регистрирует callback-хранилище
        // after_response (метод стал @deprecated/no-op), поэтому вызов
        // бросал BadMethodCallException («Method ...afterResponse does not
        // exist») ДО попытки входа — и POST /api/auth/login отдавал 500
        // вместо нормального ответа/422.
        app()->registerShutdownFunction(function () {
            try {
                $cutoff = now()->subDays(30);
                \DB::table('personal_access_tokens')
                    ->where(function ($q) use ($cutoff) {
                        $q->whereNotNull('expires_at')->where('expires_at', '<', $cutoff)
                          ->orWhere(function ($q2) use ($cutoff) {
                              $q2->where('name', 'like', 'refresh_token:%')
                                 ->where('created_at', '<', $cutoff);
                          });
                    })
                    ->limit(5000)
                    ->delete();
            } catch (\Throwable $e) {
                // чистка не должна влиять на ответ пользователю
                report($e);
            }
        });

        // Самодиагностика «вечного» бага: старые аккаунты (созданные версиями
        // кода с двойным bcrypt-хэшированием) имеют хэш длиной > 60 символов —
        // такой пароль проверить невозможно НИКОГДА, даже если пользователь
        // вводит его правильно. Раньше это выглядело как «не работает вход».
        if ($user && strlen((string) $user->password) !== 60) {
            throw ValidationException::withMessages([
                'login' => ['Пароль этого аккаунта повреждён (устаревший формат хэша). Восстановите доступ: php artisan vks:reset-passwords или сброс пароля администратором.'],
            ]);
        }

        if (!$user || !$this->verifyPassword($user, $request->password)) {
            throw ValidationException::withMessages([
                'login' => ['Неверный логин или пароль'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'login' => ['Аккаунт заблокирован. Обратитесь к администратору.'],
            ]);
        }

        $user->update(['last_login' => now()]);
        $token = $user->createToken('auth_token')->plainTextToken;

        AuditLog::log($request, 'login', $user);

        return response()->json([
            'user' => $user,
            'token' => $token,
            'refresh_token' => $this->issueRefreshToken($user),
            'expires_in' => (int) config('sanctum.expiration', 0) * 60 ?: null,
        ]);
    }

    /**
     * Обновление access-токена по refresh-токену.
     * Refresh-токен хранится в personal_access_tokens под именем "refresh_token:*".
     */
    public function refresh(Request $request)
    {
        $request->validate(['refresh_token' => 'required|string']);

        $hashed = hash('sha256', $request->refresh_token);
        $record = \DB::table('personal_access_tokens')
            ->where('name', 'like', 'refresh_token:%')
            ->where('token', $hashed)
            ->first();

        if (!$record) {
            return response()->json(['message' => 'Refresh-токен недействителен. Требуется повторный вход.'], 401);
        }

        // Одноразовость: старый refresh аннулируется
        \DB::table('personal_access_tokens')->where('id', $record->id)->delete();

        $user = User::find($record->tokenable_id);
        if (!$user || !$user->is_active) {
            return response()->json(['message' => 'Пользователь недоступен.'], 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
            'refresh_token' => $this->issueRefreshToken($user),
        ]);
    }

    /** Выход из всех устройств (отзывает все токены пользователя). */
    public function logoutAll(Request $request)
    {
        $user = $request->user();
        $user->tokens()->delete();
        AuditLog::log($request, 'logout_all', $user);

        return response()->json(['message' => 'Вы вышли из системы на всех устройствах']);
    }

    /** Список активных сессий текущего пользователя (по audit-логам входов). */
    public function sessions(Request $request)
    {
        $logs = AuditLog::query()
            ->where('user_id', $request->user()->id)
            ->where('action', 'login')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'ip' => $l->ip_address,
                'user_agent' => $l->user_agent,
                'created_at' => $l->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $logs]);
    }

    /** Выпуск refresh-токена: возвращает plain-значение, храним SHA-256-хеш. */
    private function issueRefreshToken(User $user): string
    {
        $plain = bin2hex(random_bytes(32));
        \DB::table('personal_access_tokens')->insert([
            'tokenable_type' => get_class($user),
            'tokenable_id' => $user->id,
            'name' => 'refresh_token:' . time(),
            'token' => hash('sha256', $plain),
            'abilities' => json_encode(['*']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $plain;
    }

    /**
     * Выход из системы
     */
    public function logout(Request $request)
    {
        AuditLog::log($request, 'logout', $request->user());

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Вы успешно вышли из системы',
        ]);
    }

    /**
     * Получить текущего пользователя
     */
    public function user(Request $request)
    {
        return response()->json($request->user()->load('settings'));
    }
}
