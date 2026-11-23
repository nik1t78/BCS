<?php

namespace App\Support;

use App\Models\Meeting;

final class PublicMeetingLinkPolicy
{
    /**
     * Открытая ссылка разрешена для обычных встреч.
     * Приватная встреча требует криптографически подписанный URL из QR,
     * сформированного через защищённый API для пользователя с доступом.
     */
    public static function canRedirect(Meeting $meeting, bool $hasValidSignature = false): bool
    {
        return !$meeting->is_private || $hasValidSignature;
    }
}
