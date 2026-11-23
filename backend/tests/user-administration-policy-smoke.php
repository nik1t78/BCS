<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\UserAdministrationPolicy;

$checks = [
    'admin may toggle another account' => UserAdministrationPolicy::canToggleActive('admin', 'user', 1, 2),
    'moderator may toggle ordinary user' => UserAdministrationPolicy::canToggleActive('moderator', 'user', 1, 2),
    'moderator cannot disable administrator' => !UserAdministrationPolicy::canToggleActive('moderator', 'admin', 1, 2),
    'moderator cannot disable another moderator' => !UserAdministrationPolicy::canToggleActive('moderator', 'moderator', 1, 2),
    'actor cannot disable own account' => !UserAdministrationPolicy::canToggleActive('admin', 'admin', 1, 1),
    'last active admin cannot be removed' => !UserAdministrationPolicy::canRemoveActiveAdmin('admin', true, 1),
    'one of several active admins may be removed' => UserAdministrationPolicy::canRemoveActiveAdmin('admin', true, 2),
    'inactive admin does not block admin removal' => UserAdministrationPolicy::canRemoveActiveAdmin('admin', false, 1),
    'non-admin may be removed by this safeguard' => UserAdministrationPolicy::canRemoveActiveAdmin('user', true, 1),
    'account with meeting history cannot be deleted' => !UserAdministrationPolicy::canDelete(true),
    'account without meeting history may be deleted' => UserAdministrationPolicy::canDelete(false),
];

foreach ($checks as $label => $passed) {
    if (!$passed) {
        fwrite(STDERR, "[FAIL] {$label}" . PHP_EOL);
        exit(1);
    }
    echo "[PASS] {$label}" . PHP_EOL;
}

echo "All BCS user administration policy smoke checks passed." . PHP_EOL;
