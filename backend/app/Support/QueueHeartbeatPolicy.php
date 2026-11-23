<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Detects a real PHP queue:work process, not a shell command that merely
 * contains the text "queue:work".
 */
final class QueueHeartbeatPolicy
{
    public static function isQueueWorkerCommandLine(string $commandLine): bool
    {
        $arguments = array_values(array_filter(
            explode(chr(0), $commandLine),
            static fn (string $part): bool => $part !== ''
        ));

        if (count($arguments) < 3) {
            return false;
        }

        $binary = basename($arguments[0]);
        if (!preg_match('/^php(?:[0-9]+(?:\.[0-9]+)*)?$/i', $binary)) {
            return false;
        }

        foreach ($arguments as $index => $argument) {
            if ($argument === 'artisan' && ($arguments[$index + 1] ?? null) === 'queue:work') {
                return true;
            }
        }

        return false;
    }
}
