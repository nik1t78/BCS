<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Экстренный ремонт паролей демо-пользователей БЕЗ потери остальных данных.
 *
 * Причины, по которым вход может падать с «Неверный логин или пароль»:
 *  - старый сидер записал двойной bcrypt-хэш (Hash::make + каст 'hashed');
 *  - база создана очень старой версией проекта (пароль vks_2026);
 *  - пароль был изменён и забыт.
 *
 * Команда перезаписывает пароли стандартных аккаунтов на схему «логин+123»
 * и активирует заблокированные демо-аккаунты. Остальные пользователи,
 * встречи и уведомления не затрагиваются.
 */
class ResetDemoPasswords extends Command
{
    protected $signature = 'vks:reset-passwords {--login= : сбросить пароль только одного пользователя}';

    protected $description = 'Восстановить стандартные пароли демо-аккаунтов (admin123 и т.п.) без потери данных';

    /** Стандартные аккаунты: логин => [пароль, роль] */
    private const DEMO = [
        'admin'   => ['admin123',   'admin'],
        'sidorov' => ['sidorov123', 'moderator'],
        'ivanov'  => ['ivanov123',  'user'],
        'petrova' => ['petrova123', 'user'],
    ];

    public function handle(): int
    {
        $only = $this->option('login');

        // Отключаем каст 'hashed', чтобы передать готовый хэш как есть:
        // так исключается двойное хеширование независимо от версии модели.
        User::withoutTimestamps(function () use ($only) {
            foreach (self::DEMO as $login => [$password, $role]) {
                if ($only && $only !== $login) {
                    continue;
                }

                $hash = password_hash($password, PASSWORD_BCRYPT);
                $user = User::whereRaw('LOWER(login) = ?', [strtolower($login)])->first();

                if ($user) {
                    $user->forceFill([
                        'password'  => $hash,
                        'is_active' => true,
                        'must_change_password' => false,
                    ])->saveQuietly();
                    $this->info("Пароль '{$login}' восстановлен → {$password}");
                } else {
                    // Пользователя нет (например, после down -v миграции
                    // прошли, а сид не запускался) — создаём заново.
                    User::forceCreate([
                        'name'     => ucfirst($login),
                        'login'    => $login,
                        'password' => $hash,
                        'role'     => $role,
                        'is_active' => true,
                    ]);
                    $this->warn("Пользователь '{$login}' создан, пароль: {$password}");
                }
            }
        });

        $this->line("\nГотово. Если вход всё ещё не проходит — выполните проверку:" );
        $this->line('docker compose exec backend php artisan tinker --execute="var_dump(\\Illuminate\\Support\\Facades\\Hash::check(\'admin123\', \\App\\Models\\User::where(\'login\',\'admin\')->value(\'password\')));"');

        return self::SUCCESS;
    }
}
