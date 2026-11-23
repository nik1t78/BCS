<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Http\Controllers\Api\MeetingIcsController;
use App\Models\Meeting;
use App\Services\RecurrenceService;
use Carbon\CarbonImmutable;

function assertSameValue(mixed $expected, mixed $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "[FAIL] {$label}: expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$label}" . PHP_EOL;
}

$controller = new MeetingIcsController();
$buildRule = new ReflectionMethod($controller, 'buildRRule');
$foldLine = new ReflectionMethod($controller, 'foldLine');
$escape = new ReflectionMethod($controller, 'esc');

$weekly = new Meeting([
    'date' => '2026-11-23',
    'recurring' => 'weekly',
    'repeat_until' => '2026-12-31',
]);
$rule = $buildRule->invoke($controller, $weekly);
assertSameValue(true, str_starts_with($rule, 'FREQ=WEEKLY;UNTIL='), 'weekly recurrence exports RFC5545 RRULE');

$custom = new Meeting([
    'date' => '2026-11-23',
    'recurring' => 'custom',
    'rrule' => 'RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1',
    'repeat_until' => null,
]);
assertSameValue(
    'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1',
    $buildRule->invoke($controller, $custom),
    'custom RRULE prefix is normalized'
);

$longLine = 'SUMMARY:' . str_repeat('Совещание ВКС — ', 12);
$folded = $foldLine->invoke($controller, $longLine);
$parts = explode("\r\n", $folded);
assertSameValue(true, count($parts) > 1, 'long iCalendar line is folded');
foreach ($parts as $index => $part) {
    assertSameValue(true, strlen($part) <= 75, "folded line {$index} is at most 75 octets");
    if ($index > 0) {
        assertSameValue(true, str_starts_with($part, ' '), "folded line {$index} has RFC5545 continuation space");
    }
}

assertSameValue(
    'A\\, B\\; C\\\\D\\nE',
    $escape->invoke($controller, "A, B; C\\D\nE"),
    'iCalendar text escaping'
);

$daily = new Meeting([
    'date' => '2026-11-23',
    'recurring' => 'daily',
    'status' => 'scheduled',
    'repeat_until' => '2026-12-31',
]);
assertSameValue(true, RecurrenceService::occursOn($daily, CarbonImmutable::parse('2026-11-24')), 'daily recurrence occurrence');
assertSameValue(false, RecurrenceService::occursOn($daily, CarbonImmutable::parse('2027-01-01')), 'recurrence respects repeat_until');

echo "All BCS calendar smoke checks passed." . PHP_EOL;
