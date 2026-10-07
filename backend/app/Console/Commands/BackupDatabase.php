<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Резервное копирование БД (mysqldump или sqlite-копия) с ротацией старых файлов.
 * Использование: php artisan db:backup [--keep=14]
 */
class BackupDatabase extends Command
{
    protected $signature = 'db:backup {--keep=14 : Сколько последних бэкапов хранить}';
    protected $description = 'Создать резервную копию базы данных в storage/app/backups';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $stamp = now()->format('Y-m-d_H-i-s');
        $connection = config('database.default');
        $config = config("database.connections.{$connection}");

        if (($config['driver'] ?? '') === 'sqlite') {
            $target = "{$dir}/backup-{$stamp}.sqlite";
            copy($config['database'], $target);
        } else {
            $target = "{$dir}/backup-{$stamp}.sql.gz";
            $cmd = sprintf(
                'mysqldump --single-transaction -h %s -P %s -u %s -p%s %s | gzip > %s',
                escapeshellarg($config['host'] ?? '127.0.0.1'),
                escapeshellarg((string) ($config['port'] ?? 3306)),
                escapeshellarg($config['username'] ?? ''),
                escapeshellarg($config['password'] ?? ''),
                escapeshellarg($config['database'] ?? ''),
                escapeshellarg($target)
            );
            exec($cmd, $out, $code);
            if ($code !== 0 || !file_exists($target) || filesize($target) === 0) {
                @unlink($target);
                $this->error('mysqldump завершился с ошибкой (код ' . $code . '). Проверьте доступность mysql-client.');
                return self::FAILURE;
            }
        }

        // Ротация: оставляем последние N файлов
        $files = glob("{$dir}/backup-*");
        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($files, (int) $this->option('keep')) as $old) {
            unlink($old);
        }

        $size = round(filesize($target) / 1024);
        DB::table('audit_logs')->insertOrIgnore([
            'action' => 'database_backup',
            'new_values' => json_encode(['file' => basename($target), 'size_kb' => $size]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->info("Бэкап создан: {$target} ({$size} КБ)");
        return self::SUCCESS;
    }
}
