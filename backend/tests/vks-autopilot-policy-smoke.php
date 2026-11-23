<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\VksAutopilotPolicy;

$checks = [
    'tomorrow meeting is future' => VksAutopilotPolicy::isFutureOrCurrent('2026-11-24', '08:00:00', '2026-11-23', '18:00'),
    'later today meeting is future' => VksAutopilotPolicy::isFutureOrCurrent('2026-11-23', '18:01:00', '2026-11-23', '18:00'),
    'meeting at current minute is included' => VksAutopilotPolicy::isFutureOrCurrent('2026-11-23', '18:00:00', '2026-11-23', '18:00'),
    'earlier today meeting is excluded' => !VksAutopilotPolicy::isFutureOrCurrent('2026-11-23', '17:59:00', '2026-11-23', '18:00'),
    'past date is excluded' => !VksAutopilotPolicy::isFutureOrCurrent('2026-11-22', '23:59:00', '2026-11-23', '00:01'),
    'invalid time is excluded' => !VksAutopilotPolicy::isFutureOrCurrent('2026-11-24', 'bad', '2026-11-23', '18:00'),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS VKS autopilot policy smoke checks passed." . PHP_EOL;
