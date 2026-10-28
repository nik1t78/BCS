<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    // Веб-корень тоже должен отвечать JSON (как и /api/health), иначе при
    // попадании на «чистый» домен пользователь видит страницу ошибки Laravel
    // вместо ответа сервера.
    return response()->json([
        'message' => 'ВКС Расписание API',
        'version' => '1.0.0',
        'status' => 'ok',
        'timestamp' => now()->toIso8601String(),
    ]);
});

// Пункт 5 плана: страница «экрана ожидания» в зале. Телевизор открывает
// /tv/{название зала}?token={rooms.tv_token} один раз и больше не трогает её.
// Маршрут живёт в web (а не SPA): nginx location /tv/ проксирует такие URL
// сюда, иначе SPA отдавал бы index.html и JS-модули грузились бы как HTML
// ("Failed to load module script ... MIME type text/html").
Route::get('/tv/{room}', function (string $room) {
    // Резолвим ПО НАЗВАНИЮ: телевизор открывает человекочитаемый адрес
    // /tv/Переговорная%20А%20(3%20этаж)?token=..., а не id.
    // Если зал не найден или выключен — отдаём экран с понятным сообщением
    // (не 404-заглушку Laravel: на ТВ она выглядит как «белая страница»).
    $model = \App\Models\Room::where('name', urldecode($room))
        ->where('is_active', true)
        ->first();
    if (!$model) {
        // ВАЖНО: ->status() возвращает int, а не Response — поэтому статус
        // задаём первым аргументом response()->view(...), иначе маршрут
        // возвращал бы число 404 и телевизор показывал пустую страницу.
        return response()->view('tv-screen', [
            'room'    => $room,
            'missing' => true,
        ], 404)->header('Cache-Control', 'no-store');
    }
    // Токен проверяем уже на этом этапе: без него поллинг /api/tv/... вернёт
    // 403 и телевизор показывал бы «Неверный токен экрана» вместо расписания.
    $token = (string) request()->query('token', '');
    $tvTokenOk = $token !== ''
        && (bool) $model->tv_token
        && hash_equals((string) $model->tv_token, $token);

    return response()->view('tv-screen', [
        'room'      => $room,
        'roomId'    => $model->id,
        'tvTokenOk' => $tvTokenOk,
    ])->header('Cache-Control', 'no-store');
})->where('room', '[^/]+');

// Редирект со «старого» короткого формата /m/{id} на вечную ссылку API
// (используется в QR/уведомлениях, если кто-то ввёл адрес вручную).
Route::redirect('/m/{meeting}', '/api/m/{meeting}')->whereNumber('meeting');
