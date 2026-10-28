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
    return response()->view('tv-screen', ['room' => $room])
        ->header('Cache-Control', 'no-store');
})->where('room', '[^/]+');

// Редирект со «старого» короткого формата /m/{id} на вечную ссылку API
// (используется в QR/уведомлениях, если кто-то ввёл адрес вручную).
Route::redirect('/m/{meeting}', '/api/m/{meeting}')->whereNumber('meeting');
