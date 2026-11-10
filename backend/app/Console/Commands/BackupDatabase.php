<?php

namespace App\Console\Commands;

use App\Services\AdminAlert;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Создание, проверка целостности и ротация резервных копий БД. */
class BackupDatabase extends Command
{
    protected $signature = 'db:backup {--keep=14 : Сколько последних проверенных бэкапов хранить}';
    protected $description = 'Создать и проверить резервную копию базы данных';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) {
            return $this->backupFailed('Не удалось создать каталог резервных копий.');
        }

        $stamp = now()->format('Y-m-d_H-i-s');
        $target = "{$dir}/backup-{$stamp}.sql.gz";
        $plain = "{$dir}/.backup-{$stamp}.sql";
        $defaults = "{$dir}/.mysql-{$stamp}.cnf";
        $errorFile = "{$dir}/.backup-{$stamp}.err";
        $config = config('database.connections.' . config('database.default'));

        try {
            if (($config['driver'] ?? '') !== 'mysql') {
                return $this->backupFailed('Команда поддерживает резервное копирование MySQL.');
            }

            // Пароль не передаётся аргументом процесса (ps/top) и не попадает в shell history.
            $cnf = "[client]\n" .
                'host=' . $this->cnfValue($config['host'] ?? '127.0.0.1') . "\n" .
                'port=' . (int) ($config['port'] ?? 3306) . "\n" .
                'user=' . $this->cnfValue($config['username'] ?? '') . "\n" .
                'password=' . $this->cnfValue($config['password'] ?? '') . "\n";
            if (file_put_contents($defaults, $cnf, LOCK_EX) === false) {
                return $this->backupFailed('Не удалось создать временный файл доступа MySQL.');
            }
            chmod($defaults, 0600);

            $dumpBinary = $this->findBinary(['mariadb-dump', 'mysqldump']);
            if (!$dumpBinary) {
                return $this->backupFailed('Не найден mariadb-dump/mysqldump. Установите mariadb-client в backend-образ.');
            }

            $command = [
                $dumpBinary,
                '--defaults-extra-file=' . $defaults,
                // MySQL находится в закрытой внутренней Docker-сети (DB_HOST=mysql).
                // Не проверяем самоподписанный TLS-сертификат контейнера БД:
                // иначе mariadb-dump завершается с ошибкой 2026 до создания копии.
                '--skip-ssl',
                '--single-transaction', '--quick', '--routines', '--triggers',
                '--hex-blob', '--default-character-set=utf8mb4',
                (string) ($config['database'] ?? ''),
            ];
            $pipes = [];
            $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['file', $plain, 'w'], 2 => ['file', $errorFile, 'w']], $pipes);
            if (!is_resource($process)) {
                return $this->backupFailed('Не удалось запустить процесс создания дампа.');
            }
            fclose($pipes[0]);
            $exitCode = proc_close($process);
            if ($exitCode !== 0 || !is_file($plain) || filesize($plain) < 100) {
                $detail = is_file($errorFile) ? trim((string) file_get_contents($errorFile)) : '';
                return $this->backupFailed('mysqldump завершился с ошибкой (код ' . $exitCode . '). ' . mb_substr($detail, 0, 300));
            }

            // Потоковое сжатие, без чтения всей БД в память PHP.
            $input = fopen($plain, 'rb');
            $output = gzopen($target, 'wb9');
            if (!$input || !$output) {
                if (is_resource($input)) fclose($input);
                if ($output) gzclose($output);
                return $this->backupFailed('Не удалось сжать SQL-дамп.');
            }
            while (!feof($input)) {
                $chunk = fread($input, 1024 * 1024);
                if ($chunk === false || ($chunk !== '' && gzwrite($output, $chunk) !== strlen($chunk))) {
                    fclose($input);
                    gzclose($output);
                    return $this->backupFailed('Ошибка записи сжатой резервной копии.');
                }
            }
            fclose($input);
            gzclose($output);

            // Проверка gzip-трейлера/CRC перед тем, как считать копию пригодной.
            $gzipTest = proc_open(['gzip', '-t', $target], [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', $errorFile, 'a']], $testPipes);
            if (!is_resource($gzipTest)) return $this->backupFailed('Не удалось проверить архив: gzip недоступен.');
            fclose($testPipes[0]);
            $verifyCode = proc_close($gzipTest);
            if ($verifyCode !== 0 || filesize($target) === 0) {
                return $this->backupFailed('Проверка целостности gzip не пройдена.');
            }

            @chmod($target, 0600);
            $meta = [
                'file' => basename($target),
                'size_bytes' => filesize($target),
                'sha256' => hash_file('sha256', $target),
                'verified_at' => now()->toIso8601String(),
            ];
            if (file_put_contents($target . '.json', json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) {
                return $this->backupFailed('Архив создан, но не удалось записать контрольные метаданные.');
            }
            @chmod($target . '.json', 0600);

            $keep = max(1, min(90, (int) $this->option('keep')));
            $files = glob("{$dir}/backup-*.sql.gz") ?: [];
            usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));
            foreach (array_slice($files, $keep) as $old) {
                @unlink($old);
                @unlink($old . '.json');
            }

            try {
                DB::table('audit_logs')->insertOrIgnore([
                    'action' => 'database_backup',
                    'new_values' => json_encode($meta, JSON_UNESCAPED_UNICODE),
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            } catch (Throwable) {
                // Бэкап уже создан и проверен; отсутствие audit_logs не должно его отменять.
            }

            $this->info('Резервная копия создана и проверена: ' . basename($target) . ' (' . round(filesize($target) / 1024) . ' КБ)');
            return self::SUCCESS;
        } catch (Throwable $e) {
            return $this->backupFailed('Ошибка резервного копирования: ' . mb_substr($e->getMessage(), 0, 300));
        } finally {
            @unlink($plain);
            @unlink($defaults);
            @unlink($errorFile);
        }
    }

    private function cnfValue(string $value): string
    {
        return '"' . str_replace(["\\", '"', "\n", "\r"], ["\\\\", '\\"', '\\n', '\\r'], $value) . '"';
    }

    private function findBinary(array $names): ?string
    {
        foreach ($names as $name) {
            $path = trim((string) shell_exec('command -v ' . escapeshellarg($name) . ' 2>/dev/null'));
            if ($path !== '') return $path;
        }
        return null;
    }

    private function backupFailed(string $message): int
    {
        $this->error($message);
        try { AdminAlert::send('🛑 Резервное копирование БД не выполнено: ' . $message); } catch (Throwable) {}
        return self::FAILURE;
    }
}
