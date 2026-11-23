<?php

declare(strict_types=1);

namespace App\Support;

final class FailedJobPolicy
{
    public static function summarizeException(string $exception): string
    {
        $firstLine = trim((string) (preg_split('/\r\n|\r|\n/', $exception, 2)[0] ?? ''));
        $firstLine = preg_replace('/(Bearer\s+)[A-Za-z0-9._~+\/-]+/i', '$1[скрыто]', $firstLine) ?? $firstLine;
        $firstLine = preg_replace('/((?:password|token|secret|authorization)\s*[=:]\s*)[^\s,;]+/i', '$1[скрыто]', $firstLine) ?? $firstLine;

        return mb_substr($firstLine, 0, 400);
    }
}
