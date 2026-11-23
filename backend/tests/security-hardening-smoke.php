<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Models\Meeting;
use App\Support\PublicMeetingLinkPolicy;
use App\Support\RefreshTokenPolicy;
use Carbon\CarbonImmutable;

function assertSecurityHardening(bool $expected, bool $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$label}" . PHP_EOL;
}

$publicMeeting = new Meeting(['is_private' => false]);
$privateMeeting = new Meeting(['is_private' => true]);

assertSecurityHardening(true, PublicMeetingLinkPolicy::canRedirect($publicMeeting), 'public meeting keeps permanent join link');
assertSecurityHardening(false, PublicMeetingLinkPolicy::canRedirect($privateMeeting), 'private meeting cannot be exposed by permanent public link');

$now = CarbonImmutable::parse('2026-11-23 12:00:00');
assertSecurityHardening(false, RefreshTokenPolicy::isExpired('2026-12-23 12:00:00', '2026-11-23 12:00:00', 30, $now), 'valid explicit expiry is accepted');
assertSecurityHardening(true, RefreshTokenPolicy::isExpired('2026-11-23 11:59:59', '2026-11-01 12:00:00', 30, $now), 'expired explicit token is rejected');
assertSecurityHardening(false, RefreshTokenPolicy::isExpired(null, '2026-11-01 12:00:00', 30, $now), 'legacy token within compatibility window remains valid');
assertSecurityHardening(true, RefreshTokenPolicy::isExpired(null, '2026-10-01 12:00:00', 30, $now), 'legacy token older than compatibility window is rejected');
assertSecurityHardening(true, RefreshTokenPolicy::isExpired(null, null, 30, $now), 'token without expiry and creation time is rejected');

echo "All BCS security hardening smoke checks passed." . PHP_EOL;
