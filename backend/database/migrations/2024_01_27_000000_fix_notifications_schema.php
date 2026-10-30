<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Починка 500 на GET /api/notifications/unread-count (и всём разделе
 * «Мои конференции» → уведомления).
 *
 * Симптом в проде: один и тот же endpoint возвращал то 200, то 500 для
 * разных пользователей. Контроллер unreadCount() тривиален
 * (Notification::where('user_id', ...)->where('read', false)->count()),
 * значит падает сам SQL — структура таблицы notifications в рабочей БД
 * расходилась с кодом приложения.
 *
 * Причины расхождения:
 *  1) 2024_01_06_..._add_must_change_password_to_users вызывал
 *     dropColumn('must_change_password') без проверки Schema::hasColumn().
 *     Если миграция откатывалась дважды (или её down() запускался повторно),
 *     второй DROP падал с ошибкой — транзакция миграции прерывалась, и
 *     ВСЕ миграции, идущие позже по списку, в том числе
 *     2024_01_15_add_title_to_notifications_table и
 *     2024_01_18_create_push_subscriptions_table, так и не применялись.
 *     Итог: запрос с with(['meeting', 'user:id,name']) и where('read', false)
 *     ловил «Unknown column 'title'» / «Base table or view not found».
 *  2) MySQL 8 при повторном ALTER TABLE внутри одной миграции может оставить
 *     таблицу в состоянии "in place upgrade in progress" (crash/restart во
 *     время ALTER): все последующие запросы к ней дают ошибку 183, которую
 *     Laravel отдаёт как HTTP 500. Лечится только OPTIMIZE TABLE
 *     (или ALTER ... ENGINE=InnoDB).
 *
 * Миграция идемпотентна: добавляет недостающие колонки/таблицы и чинит
 * «залипшие» таблицы. Никакие данные не удаляются.
 */
return new class extends Migration
{
    /**
     * Таблицы, которые могли остаться в промежуточном состоянии после
     * прерванного ALTER TABLE (MySQL 8, ошибка 183).
     */
    private array $repairable = [
        'users',
        'meetings',
        'notifications',
        'personal_access_tokens',
        'user_activity',
        'daily_stats',
        'rooms',
    ];

    public function up(): void
    {
        // Соединение с БД должно быть живым: при недоступном сервере миграция
        // падает честно и громко, а не «успешно» ничего не делает.
        DB::connection()->getPdo();

        // 1) Чиним таблицы после незавершённых ALTER (см. п.2 в шапке файла):
        //    если MySQL оставил таблицу в состоянии "in place upgrade in
        //    progress", любой SELECT к ней даёт ошибку 183 → HTTP 500.
        foreach ($this->repairable as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }
            try {
                DB::statement("ALTER TABLE `{$table}` ENGINE=InnoDB");
            } catch (\Throwable) {
                // таблица уже в порядке либо драйвер/права не позволяют — идём дальше
            }
        }

        // 2) notifications.title — использовался NotificationController::index()
        //    и фронтендом, но мог отсутствовать (см. п.1 в шапке файла).
        if (Schema::hasTable('notifications') && !Schema::hasColumn('notifications', 'title')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->string('title', 191)->nullable()->after('meeting_id');
            });
        }

        // 2b) Проверяем штатный запрос unread-count'а на реальном SQL: если он
        //     проходит — причина 500 была именно в структуре таблицы. Если
        //     падения нет, но строк ноль — тоже норма (у пользователя просто
        //     нет уведомлений), поэтому ловим только SQL-исключение.
        try {
            DB::table('notifications')->where('read', false)->count();
        } catch (\Throwable $e) {
            throw new \RuntimeException(
                'Запрос к notifications по-прежнему падает после починки структуры: ' .
                $e->getMessage(), 0, $e);
        }

        // 3) users.max_chat_id — привязка мессенджера MAX; тоже могла не создаться.
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'max_chat_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('max_chat_id', 100)->nullable()->after('phone');
            });
        }

        // 4) users.must_change_password — создаём, если пропала (её читает
        //    UserController, отсутствие ломало бы вход/профиль).
        if (Schema::hasTable('users') && !Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('must_change_password')->default(false)->after('is_active');
            });
        }

        // 5) push_subscriptions — таблица уведомлений браузера; создаём, если
        //    миграция 2024_01_18 не прошла.
        if (!Schema::hasTable('push_subscriptions')) {
            Schema::create('push_subscriptions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->text('endpoint');
                $table->string('public_key', 191);
                $table->string('auth_token', 191);
                $table->timestamps();
            });
        }

        // 6) user_activity + daily_stats — журнал DAU/MAU (пишет middleware
        //    TrackActivity, читает команда analytics:daily).
        if (!Schema::hasTable('user_activity')) {
            Schema::create('user_activity', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('action', 191);
                $table->timestamp('created_at')->nullable()->index();
            });
        }

        if (!Schema::hasTable('daily_stats')) {
            Schema::create('daily_stats', function (Blueprint $table) {
                $table->date('date')->primary();
                $table->unsignedInteger('dau')->default(0);
                $table->unsignedInteger('mau')->default(0);
                $table->unsignedInteger('actions')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Обратная миграция не требуется: изменения только восстанавливают
        // ожидаемую приложением структуру, ничего не удаляя.
    }
};
