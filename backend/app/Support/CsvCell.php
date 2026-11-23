<?php

namespace App\Support;

/**
 * Защита CSV-экспорта от formula injection при открытии в Excel/LibreOffice.
 */
final class CsvCell
{
    public static function safe(mixed $value): string
    {
        $value = (string) ($value ?? '');
        $probe = ltrim($value);

        if ($probe !== '' && preg_match('/^[=+\-@\t\r]/u', $probe)) {
            return "'" . $value;
        }

        return $value;
    }
}
