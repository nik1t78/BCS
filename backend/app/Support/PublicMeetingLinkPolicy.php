<?php

namespace App\Support;

use App\Models\Meeting;

final class PublicMeetingLinkPolicy
{
    /**
     * Постоянная ссылка /api/m/{id} доступна только для непублично закрытых встреч.
     * Для приватных встреч требуется авторизованный API-сценарий.
     */
    public static function canRedirect(Meeting $meeting): bool
    {
        return !$meeting->is_private;
    }
}
