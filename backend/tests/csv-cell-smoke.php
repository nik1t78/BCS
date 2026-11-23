<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\\Support\\CsvCell;

$cases = [
    ['=1+1', "'=1+1", 'formula prefix'],
    ['  @SUM(A1:A2)', "'  @SUM(A1:A2)", 'formula after leading whitespace'],
    ['+cmd', "'+cmd", 'plus prefix'],
    ['-1+2', "'-1+2", 'minus prefix'],
    ['Обычный пользователь', 'Обычный пользователь', 'normal Cyrillic text'],
    ['', '', 'empty cell'],
];

foreach ($cases as [$input, $expected, $label]) {
    $actual = CsvCell::safe($input);
    if ($actual !== $expected) {
        fwrite(STDERR, "[FAIL] {$label}: " . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS CSV safety smoke checks passed." . PHP_EOL;
