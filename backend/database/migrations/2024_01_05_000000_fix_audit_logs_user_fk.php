<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * В некоторых развёрнутых базах внешний ключ audit_logs.user_id был создан
 * без ON DELETE SET NULL (или как RESTRICT). Из-за этого удаление пользователя
 * из админ-панели падало с ошибкой целостности (500), если у пользователя
 * были записи в журнале аудита.
 *
 * Миграция находит FK таблицы audit_logs, ведущий на users, и пересоздаёт его
 * с ON DELETE SET NULL. Выполняется только для MySQL/MariaDB; для SQLite
 * (где каскады задаются при создании таблицы) миграция — no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'])) {
            return;
        }

        if (!Schema::hasTable('audit_logs') || !Schema::hasColumn('audit_logs', 'user_id')) {
            return;
        }

        $database = DB::connection()->getDatabaseName();

        // ВАЖНО: DB::select_one() существует только в Laravel 11+.
        // В более старых версиях используем стандартный DB::select().
        $rows = DB::select(
            'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
               AND REFERENCED_TABLE_NAME = ? LIMIT 1',
            [$database, 'audit_logs', 'user_id', 'users']
        );

        if (empty($rows)) {
            return;
        }

        $name = $rows[0]->CONSTRAINT_NAME;

        // Отвязываем «сирот» — записи аудита удалённых пользователей,
        // иначе ALTER не сможет применить новый FK.
        DB::statement(
            'UPDATE audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             SET al.user_id = NULL
             WHERE al.user_id IS NOT NULL AND u.id IS NULL'
        );

        DB::statement("ALTER TABLE audit_logs DROP FOREIGN KEY `{$name}`");
        DB::statement(
            'ALTER TABLE audit_logs
             ADD CONSTRAINT `audit_logs_user_id_foreign`
             FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
        );
    }

    public function down(): void
    {
        // Обратное изменение намеренно не выполняется: старый FK без
        // ON DELETE SET NULL ломает удаление пользователей.
    }
};
