<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\MeetingPollPolicy;

$checks = [
    'organizer can manage polls' => MeetingPollPolicy::canManage(10, 10, 'user'),
    'admin can manage polls' => MeetingPollPolicy::canManage(10, 20, 'admin'),
    'moderator can manage polls' => MeetingPollPolicy::canManage(10, 20, 'moderator'),
    'ordinary non-organizer cannot manage polls' => !MeetingPollPolicy::canManage(10, 20, 'user'),
    'accessible user can vote while poll is open' => MeetingPollPolicy::canVote(true, false, 3, 2),
    'private meeting outsider cannot vote' => !MeetingPollPolicy::canVote(false, false, 3, 0),
    'closed poll rejects votes' => !MeetingPollPolicy::canVote(true, true, 3, 0),
    'out-of-range option rejects vote' => !MeetingPollPolicy::canVote(true, false, 2, 2),
    'negative option rejects vote' => !MeetingPollPolicy::canVote(true, false, 2, -1),
    'options are trimmed and de-duplicated case-insensitively' =>
        MeetingPollPolicy::normalizeOptions([' Да ', 'нет', 'да', '', '  ']) === ['Да', 'нет'],
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All meeting poll policy smoke checks passed." . PHP_EOL;
