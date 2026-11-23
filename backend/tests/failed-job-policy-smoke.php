<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\FailedJobPolicy;

$bearer = FailedJobPolicy::summarizeException('RuntimeException: Bearer abc.def.ghi');
$password = FailedJobPolicy::summarizeException('RuntimeException: password=super-secret');
$token = FailedJobPolicy::summarizeException('RuntimeException: token:private-token');
$multiline = FailedJobPolicy::summarizeException("RuntimeException: failed\n#0 /app/vendor/file.php");
$long = FailedJobPolicy::summarizeException('RuntimeException: ' . str_repeat('x', 600));

$checks = [
    'Bearer credential is redacted' => !str_contains($bearer, 'abc.def.ghi') && str_contains($bearer, '[скрыто]'),
    'password value is redacted' => !str_contains($password, 'super-secret') && str_contains($password, '[скрыто]'),
    'token value is redacted' => !str_contains($token, 'private-token') && str_contains($token, '[скрыто]'),
    'stack trace lines are not exposed' => !str_contains($multiline, '#0'),
    'summary is capped at 400 characters' => mb_strlen($long) <= 400,
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS failed job summary smoke checks passed." . PHP_EOL;
