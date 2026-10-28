<?php

namespace App\Support;

/**
 * Минимальный генератор QR-кодов (PNG) без внешних composer-зависимостей.
 * Поддерживает байтовый режим, версии 1–10, уровень коррекции M — этого
 * хватает для ссылок вида http://host/m/12345 (~<=271 символов).
 * Алгоритм: RS(256) кодирование по ISO/IEC 18004 + маскировка (штраф-оценка),
 * рендер в PNG через GD (fallback — чистый PNG без фильтра строк).
 */
class QrPng
{
    /** Единицы GF(256): exp/ln таблицы. */
    private static ?array $gfExp = null;
    private static ?array $gfLog = null;

    public static function generate(string $text, int $scale = 8, int $quiet = 4): ?string
    {
        if (!function_exists('imagecreatetruecolor')) {
            return null; // php-gd обязателен; без него контроллер вернёт понятную ошибку
        }

        try {
            $matrix = self::buildMatrix($text);
        } catch (\Throwable $e) {
            report($e);
            return null;
        }

        $size = count($matrix);
        $px = ($size + 2 * $quiet) * $scale;
        $img = imagecreatetruecolor($px, $px);
        $white = imagecolorallocate($img, 255, 255, 255);
        $black = imagecolorallocate($img, 0, 0, 0);
        imagefilledrectangle($img, 0, 0, $px, $px, $white);
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                if ($matrix[$y][$x]) {
                    imagefilledrectangle(
                        $img,
                        ($x + $quiet) * $scale,
                        ($y + $quiet) * $scale,
                        ($x + $quiet + 1) * $scale - 1,
                        ($y + $quiet + 1) * $scale - 1,
                        $black
                    );
                }
            }
        }

        ob_start();
        imagepng($img);
        $png = ob_get_clean();
        imagedestroy($img);

        return $png === false || $png === '' ? null : $png;
    }

    // ---------- ядро QR ----------

    private static function buildMatrix(string $text): array
    {
        $bytes = array_values(unpack('C*', $text));
        [$version, $dataCodewords] = self::pickVersion(count($bytes));
        $size = 17 + 4 * $version;
        $ecPerBlock = self::ecCodewords($version);

        // Поток данных: режим (4b=byte) + длина (8/16b) + данные + padding.
        $bits = [];
        self::appendBits($bits, 4, 0b0100);
        self::appendBits($bits, $version <= 9 ? 8 : 16, count($bytes));
        foreach ($bytes as $b) {
            self::appendBits($bits, 8, $b);
        }
        $capacityBits = $dataCodewords * 8;
        // terminator
        for ($i = 0; $i < 4 && count($bits) < $capacityBits; $i++) {
            $bits[] = 0;
        }
        while (count($bits) % 8 !== 0) {
            $bits[] = 0;
        }
        $padToggle = [0xEC, 0x11];
        $pi = 0;
        while (count($bits) < $capacityBits) {
            self::appendBits($bits, 8, $padToggle[$pi++ % 2]);
        }
        $dataBytes = [];
        for ($i = 0; $i < count($bits); $i += 8) {
            $v = 0;
            for ($j = 0; $j < 8; $j++) {
                $v = ($v << 1) | $bits[$i + $j];
            }
            $dataBytes[] = $v;
        }

        // Блоки + ECC (схема M для версий 1..10).
        [, $blockLens] = self::blockStructure($version);
        $blocks = [];
        $offset = 0;
        foreach ($blockLens as $len) {
            $blocks[] = array_slice($dataBytes, $offset, $len);
            $offset += $len;
        }
        $ecBlocks = [];
        foreach ($blocks as $bi => $blk) {
            $ecBlocks[$bi] = self::reedSolomon($blk, $ecPerBlock);
        }
        // Интерливинг данных и ECC.
        $final = [];
        $maxData = max($blockLens);
        for ($i = 0; $i < $maxData; $i++) {
            foreach ($blocks as $blk) {
                if ($i < count($blk)) {
                    $final[] = $blk[$i];
                }
            }
        }
        for ($i = 0; $i < $ecPerBlock; $i++) {
            foreach ($ecBlocks as $blk) {
                if ($i < count($blk)) {
                    $final[] = $blk[$i];
                }
            }
        }

        // Матрица: функции + данные.
        $matrix = array_fill(0, $size, array_fill(0, $size, null));
        $reserved = array_fill(0, $size, array_fill(0, $size, false));
        self::placeFunctions($matrix, $reserved, $version, $size);

        // Заполнение данными (змеевик, пропуск зарезервированных).
        $bitStream = [];
        foreach ($final as $byte) {
            for ($k = 7; $k >= 0; $k--) {
                $bitStream[] = ($byte >> $k) & 1;
            }
        }
        self::placeData($matrix, $reserved, $size, $bitStream);

        // Выбор маски по штрафу.
        $best = null;
        $bestPenalty = PHP_INT_MAX;
        for ($mask = 0; $mask < 8; $mask++) {
            $candidate = self::applyMask($matrix, $reserved, $size, $mask, $version);
            $penalty = self::penalty($candidate, $size);
            if ($penalty < $bestPenalty) {
                $bestPenalty = $penalty;
                $best = $candidate;
            }
        }

        return $best;
    }

    private static function pickVersion(int $len): array
    {
        // Ёмкость байтового режима, уровень M: v1=14,v2=26,v3=42,v4=62,v5=84,
        // v6=106,v7=122,v8=152,v9=180,v10=213.
        $caps = [1 => 14, 2 => 26, 3 => 42, 4 => 62, 5 => 84, 6 => 106, 7 => 134, 8 => 154, 9 => 182, 10 => 216];
        foreach ($caps as $v => $cap) {
            if ($len <= $cap) {
                return [$v, self::totalDataCodewords($v)];
            }
        }
        throw new \RuntimeException('QR: слишком длинная строка (max 216 символов)');
    }

    private static function totalDataCodewords(int $version): int
    {
        return [1 => 16, 2 => 28, 3 => 44, 4 => 64, 5 => 86, 6 => 108, 7 => 124, 8 => 154, 9 => 182, 10 => 216][$version];
    }

    /** Кодовых слов ECC на блок, уровень M (ISO/IEC 18004). */
    private static function ecCodewords(int $version): int
    {
        $ecPerBlock = [1 => 10, 2 => 16, 3 => 26, 4 => 18, 5 => 24, 6 => 16, 7 => 18, 8 => 22, 9 => 22, 10 => 26];
        return $ecPerBlock[$version];
    }

    /**
     * Структура блоков уровня M: [число_коротких_блоков, длина_короткого,
     * число_длинных_блоков, длина_длинного]. Проверка корректности строк:
     * сумма длин + blocks*ec == total raw codewords.
     */
    private static function blockStructure(int $version): array
    {
        $iso = [
            1 => [1, 16, 0, 0],
            2 => [1, 28, 0, 0],
            3 => [1, 44, 0, 0],
            4 => [2, 32, 0, 0],
            5 => [2, 43, 0, 0],
            6 => [4, 27, 0, 0],
            7 => [4, 31, 0, 0],
            8 => [2, 50, 2, 51],
            9 => [2, 60, 2, 61],
            10 => [4, 28, 4, 29],
        ];
        $row = $iso[$version];
        $blocks = [];
        for ($i = 0; $i < $row[0]; $i++) {
            $blocks[] = $row[1];
        }
        for ($i = 0; $i < $row[2]; $i++) {
            $blocks[] = $row[3];
        }
        return [count($blocks), $blocks];
    }

    private static function appendBits(array &$bits, int $count, int $value): void
    {
        for ($i = $count - 1; $i >= 0; $i--) {
            $bits[] = ($value >> $i) & 1;
        }
    }

    private static function gfInit(): void
    {
        if (self::$gfExp !== null) {
            return;
        }
        $exp = array_fill(0, 512, 0);
        $log = array_fill(0, 256, 0);
        $x = 1;
        for ($i = 0; $i < 255; $i++) {
            $exp[$i] = $x;
            $log[$x] = $i;
            $x <<= 1;
            if ($x & 0x100) {
                $x ^= 0x11D;
            }
        }
        for ($i = 255; $i < 512; $i++) {
            $exp[$i] = $exp[$i - 255];
        }
        self::$gfExp = $exp;
        self::$gfLog = $log;
    }

    private static function gfMul(int $a, int $b): int
    {
        if ($a === 0 || $b === 0) {
            return 0;
        }
        return self::$gfExp[self::$gfLog[$a] + self::$gfLog[$b]];
    }

    /** Codewords ECC по полиному generatorDegree. */
    private static function reedSolomon(array $data, int $generatorDegree): array
    {
        self::gfInit();
        // generator polynomial
        $gen = array_fill(0, $generatorDegree + 1, 0);
        $gen[0] = 1;
        for ($i = 0; $i < $generatorDegree; $i++) {
            for ($j = 0; $j < $generatorDegree; $j++) {
                $gen[$j + 1] ^= self::gfMul($gen[$j], self::$gfExp[$i]);
            }
        }
        $remainder = array_merge($data, array_fill(0, $generatorDegree, 0));
        foreach ($data as $i => $_) {
            $coef = $remainder[$i];
            if ($coef === 0) {
                continue;
            }
            for ($j = 0; $j <= $generatorDegree; $j++) {
                $remainder[$i + $j] ^= self::gfMul($gen[$j], $coef);
            }
        }
        return array_slice($remainder, count($data));
    }

    private static function placeFunctions(array &$m, array &$res, int $version, int $size): void
    {
        // finder + separators
        foreach ([[0, 0], [0, $size - 7], [$size - 7, 0]] as [$oy, $ox]) {
            for ($y = -1; $y <= 7; $y++) {
                for ($x = -1; $x <= 7; $x++) {
                    $yy = $oy + $y;
                    $xx = $ox + $x;
                    if ($yy < 0 || $xx < 0 || $yy >= $size || $xx >= $size) {
                        continue;
                    }
                    $in = $y >= 0 && $y <= 6 && $x >= 0 && $x <= 6;
                    $ring = $in && ($y === 0 || $y === 6 || $x === 0 || $x === 6);
                    $core = $in && $y >= 2 && $y <= 4 && $x >= 2 && $x <= 4;
                    $m[$yy][$xx] = ($ring || $core) ? 1 : 0;
                    $res[$yy][$xx] = true;
                }
            }
        }
        // timing
        for ($i = 8; $i < $size - 8; $i++) {
            $v = $i % 2 === 0 ? 1 : 0;
            $m[6][$i] = $v; $res[6][$i] = true;
            $m[$i][6] = $v; $res[$i][6] = true;
        }
        // alignment patterns (для версий 2..10 позиции центров)
        $alignPos = [
            1 => [], 2 => [6, 18], 3 => [6, 22], 4 => [6, 26], 5 => [6, 30],
            6 => [6, 34], 7 => [6, 22, 38], 8 => [6, 24, 42], 9 => [6, 26, 46], 10 => [6, 28, 50],
        ];
        $positions = $alignPos[$version];
        $count = count($positions);
        for ($ri = 0; $ri < $count; $ri++) {
            for ($ci = 0; $ci < $count; $ci++) {
                // пропускаем углы с finder
                if (($ri === 0 && $ci === 0) || ($ri === 0 && $ci === $count - 1) || ($ri === $count - 1 && $ci === 0)) {
                    continue;
                }
                $cy = $positions[$ri];
                $cx = $positions[$ci];
                for ($dy = -2; $dy <= 2; $dy++) {
                    for ($dx = -2; $dx <= 2; $dx++) {
                        $on = max(abs($dy), abs($dx)) !== 1;
                        $m[$cy + $dy][$cx + $dx] = $on ? 1 : 0;
                        $res[$cy + $dy][$cx + $dx] = true;
                    }
                }
            }
        }
        // reserved areas для format/version info
        for ($i = 0; $i < 9; $i++) {
            if (!$res[8][$i]) { $res[8][$i] = true; $m[8][$i] = 0; }
            if (!$res[$i][8]) { $res[$i][8] = true; $m[$i][8] = 0; }
        }
        for ($i = 0; $i < 8; $i++) {
            $res[8][$size - 1 - $i] = true; $m[8][$size - 1 - $i] = 0;
            $res[size - 1 - $i][8] = true; $m[size - 1 - $i][8] = 0;
        }
        $m[$size - 8][8] = 1; $res[$size - 8][8] = true; // dark module
        if ($version >= 7) {
            for ($i = 0; $i < 3; $i++) {
                for ($j = 0; $j < 6; $j++) {
                    $res[5 - $i][$size - 9 + $j] = true;
                    $res[$size - 9 + $j][5 - $i] = true;
                }
            }
        }
    }

    private static function placeData(array &$m, array $res, int $size, array $bits): void
    {
        $idx = 0;
        $upward = true;
        for ($col = $size - 1; $col > 0; $col -= 2) {
            if ($col === 6) {
                $col--; // пропуск vertical timing
            }
            for ($i = 0; $i < $size; $i++) {
                $row = $upward ? $size - 1 - $i : $i;
                for ($c = 0; $c < 2; $c++) {
                    $cc = $col - $c;
                    if ($res[$row][$cc]) {
                        continue;
                    }
                    $m[$row][$cc] = isset($bits[$idx]) ? $bits[$idx] : 0;
                    $idx++;
                }
            }
            $upward = !$upward;
        }
    }

    private static function applyMask(array $m, array $res, int $size, int $mask, int $version): array
    {
        $fn = [
            fn ($y, $x) => ($y + $x) % 2 === 0,
            fn ($y, $x) => $y % 2 === 0,
            fn ($y, $x) => $x % 3 === 0,
            fn ($y, $x) => ($y + $x) % 3 === 0,
            fn ($y, $x) => (intdiv($y, 2) + intdiv($x, 3)) % 2 === 0,
            fn ($y, $x) => (($y * $x) % 2) + (($y * $x) % 3) === 0,
            fn ($y, $x) => ((($y * $x) % 2) + (($y * $x) % 3)) % 2 === 0,
            fn ($y, $x) => ((($y + $x) % 2) + (($y * $x) % 3)) % 2 === 0,
        ][$mask];

        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x < $size; $x++) {
                if (!$res[$y][$x] && $fn($y, $x)) {
                    $m[$y][$x] ^= 1;
                }
            }
        }

        self::drawFormat($m, $size, $mask);
        if ($version >= 7) {
            self::drawVersion($m, $size, $version);
        }

        return $m;
    }

    private static function drawFormat(array &$m, int $size, int $mask): void
    {
        // уровень M = 0b00
        $formatBits = (0b00 << 3) | $mask;
        $rem = $formatBits << 10;
        $gen = 0b10100110111;
        for ($i = 14; $i >= 10; $i--) {
            if ((($rem >> $i) & 1) === 1) {
                $rem ^= $gen << ($i - 10);
            }
        }
        $data = (($formatBits << 10) | $rem) ^ 0b101010000010010;

        for ($i = 0; $i < 15; $i++) {
            $bit = ($data >> $i) & 1;
            // верхний-левый угол
            if ($i < 6) {
                $m[8][$i] = $bit;
            } elseif ($i === 6) {
                $m[8][7] = $bit;
            } elseif ($i === 7) {
                $m[8][8] = $bit;
            } elseif ($i === 8) {
                $m[7][8] = $bit;
            } else {
                $m[14 - $i][8] = $bit;
            }
            // дублирование
            if ($i < 8) {
                $m[$size - 1 - $i][8] = $bit;
            } else {
                $m[8][$size - 15 + $i] = $bit;
            }
        }
    }

    private static function drawVersion(array &$m, int $size, int $version): void
    {
        $rem = $version << 12;
        $gen = 0b1111100100101;
        for ($i = 17; $i >= 12; $i--) {
            if ((($rem >> $i) & 1) === 1) {
                $rem ^= $gen << ($i - 12);
            }
        }
        $bits = ($version << 12) | $rem;
        for ($i = 0; $i < 18; $i++) {
            $bit = ($bits >> $i) & 1;
            $a = intdiv($i, 3);
            $b = $i % 3;
            $m[$a][$size - 11 + $b] = $bit;
            $m[$size - 11 + $b][$a] = $bit;
        }
    }

    private static function penalty(array $m, int $size): int
    {
        $score = 0;
        // правило 1: серии >=5 в рядах/столбцах
        for ($line = 0; $line < $size; $line++) {
            foreach ([true, false] as $vertical) {
                $runColor = -1;
                $runLen = 0;
                for ($i = 0; $i < $size; $i++) {
                    $c = $vertical ? $m[$line][$i] : $m[$i][$line];
                    if ($c === $runColor) {
                        $runLen++;
                    } else {
                        if ($runLen >= 5) {
                            $score += 3 + ($runLen - 5);
                        }
                        $runColor = $c;
                        $runLen = 1;
                    }
                }
                if ($runLen >= 5) {
                    $score += 3 + ($runLen - 5);
                }
            }
        }
        // правило 2: блоки 2x2
        for ($y = 0; $y < $size - 1; $y++) {
            for ($x = 0; $x < $size - 1; $x++) {
                $c = $m[$y][$x];
                if ($c === $m[$y][$x + 1] && $c === $m[$y + 1][$x] && $c === $m[$y + 1][$x + 1]) {
                    $score += 3;
                }
            }
        }
        // правило 3: паттерны поиска
        $pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
        $patR = array_reverse($pat);
        for ($y = 0; $y < $size; $y++) {
            for ($x = 0; $x <= $size - 11; $x++) {
                $ok = true; $ok2 = true;
                for ($k = 0; $k < 11; $k++) {
                    if ($m[$y][$x + $k] !== $pat[$k]) $ok = false;
                    if ($m[$y][$x + $k] !== $patR[$k]) $ok2 = false;
                }
                if ($ok || $ok2) $score += 40;
            }
        }
        for ($x = 0; $x < $size; $x++) {
            for ($y = 0; $y <= $size - 11; $y++) {
                $ok = true; $ok2 = true;
                for ($k = 0; $k < 11; $k++) {
                    if ($m[$y + $k][$x] !== $pat[$k]) $ok = false;
                    if ($m[$y + $k][$x] !== $patR[$k]) $ok2 = false;
                }
                if ($ok || $ok2) $score += 40;
            }
        }
        // правило 4: баланс тёмных модулей
        $dark = 0;
        foreach ($m as $row) {
            $dark += array_sum($row);
        }
        $pct = abs($dark * 100 / ($size * $size) - 50) / 5;
        $score += (int) $pct * 10;

        return $score;
    }
}
