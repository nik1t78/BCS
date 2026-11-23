<?php

declare(strict_types=1);

$bootstrap = (string) file_get_contents(__DIR__ . '/../bootstrap/app.php');

$checks = [
    'API exception responses include a correlation identifier' =>
        str_contains($bootstrap, "'error_id' => $errorId"),
    'API exception details are logged server-side' =>
        str_contains($bootstrap, "'exception' => get_class($e)")
        && str_contains($bootstrap, "'file' => $e->getFile()"),
    'API error logs do not include query strings' =>
        str_contains($bootstrap, '$request->path()')
        && !str_contains($bootstrap, '$request->fullUrl()'),
    'API exception message is not returned to clients' =>
        !str_contains($bootstrap, "'message' => $e->getMessage()"),
    'Exception class and file path are not returned as detail' =>
        !str_contains($bootstrap, "'detail' => get_class($e)"),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All API error redaction smoke checks passed." . PHP_EOL;
