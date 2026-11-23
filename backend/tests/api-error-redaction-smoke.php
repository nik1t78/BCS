<?php

declare(strict_types=1);

$bootstrap = (string) file_get_contents(__DIR__ . '/../bootstrap/app.php');

$statusStart = strpos($bootstrap, '$status = method_exists($e');
$responseStart = $statusStart === false
    ? false
    : strpos($bootstrap, 'return response()->json([', $statusStart);
$responseEnd = $responseStart === false
    ? false
    : strpos($bootstrap, '], $status);', $responseStart);
$responseBlock = ($responseStart !== false && $responseEnd !== false)
    ? substr($bootstrap, $responseStart, $responseEnd - $responseStart)
    : '';

$checks = [
    'API exception responses include a correlation identifier' =>
        $responseBlock !== '' && str_contains($responseBlock, "'error_id' => $errorId"),
    'API exception details are logged server-side' =>
        str_contains($bootstrap, "'exception' => get_class($e)")
        && str_contains($bootstrap, "'file' => $e->getFile()"),
    'API error logs do not include query strings' =>
        str_contains($bootstrap, "'[API-ERROR] ' . $request->method() . ' ' . $request->path()")
        && !str_contains($bootstrap, "'[API-ERROR] ' . $request->method() . ' ' . $request->fullUrl()"),
    'API exception messages are not returned to clients' =>
        $responseBlock !== '' && !str_contains($responseBlock, '$e->getMessage()'),
    'Exception class and file path are not returned to clients' =>
        $responseBlock !== '' && !str_contains($responseBlock, "'detail'"),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All API error redaction smoke checks passed." . PHP_EOL;
