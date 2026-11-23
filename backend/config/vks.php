<?php

return [
    // Интервалы напоминаний участникам без подтверждённого RSVP, в минутах.
    // Пустая строка отключает функцию. Пример: 1440,60 (за сутки и за час).
    'rsvp_reminder_minutes' => env('RSVP_REMINDER_MINUTES', '1440,60'),

    // Публичная регистрация выключена по умолчанию: учётные записи создаёт администратор.
    'public_registration' => (bool) env('BCS_PUBLIC_REGISTRATION', false),

    // Одноразовый refresh-токен имеет ограниченный срок действия.
    'refresh_token_ttl_days' => max(1, (int) env('BCS_REFRESH_TOKEN_TTL_DAYS', 30)),
];
