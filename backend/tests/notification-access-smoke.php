<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\NotificationAccess;
use Illuminate\Http\Request;

function assertNotificationPolicy(bool $expected, bool $actual, string $label): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$label}" . PHP_EOL;
}

$adminAll = Request::create('/', 'GET', ['all' => '1']);
$adminDefault = Request::create('/', 'GET');
$userAll = Request::create('/', 'GET', ['all' => '1']);

assertNotificationPolicy(true, NotificationAccess::canManageAll('admin', $adminAll->boolean('all')), 'admin can explicitly enter all-notifications mode');
assertNotificationPolicy(false, NotificationAccess::canManageAll('admin', $adminDefault->boolean('all')), 'admin defaults to own notifications');
assertNotificationPolicy(false, NotificationAccess::canManageAll('user', $userAll->boolean('all')), 'regular user cannot access other users notifications');
assertNotificationPolicy(false, NotificationAccess::canManageAll('moderator', $adminAll->boolean('all')), 'moderator cannot access global notifications');

echo "All BCS notification access smoke checks passed." . PHP_EOL;
