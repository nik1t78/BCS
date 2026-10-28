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
        return tvScreenResponse([
            'room'    => $room,
            'missing' => true,
        ], 404);
    }
    // Токен проверяем уже на этом этапе: без него поллинг /api/tv/... вернёт
    // 403 и телевизор показывал бы «Неверный токен экрана» вместо расписания.
    $token = (string) request()->query('token', '');
    $tvTokenOk = $token !== ''
        && (bool) $model->tv_token
        && hash_equals((string) $model->tv_token, $token);

    return tvScreenResponse([
        'room'      => $room,
        'roomId'    => $model->id,
        'tvTokenOk' => $tvTokenOk,
    ]);
})->where('room', '[^/]+');

// Экран рендерится nginx-ом с CSP script-src 'self' (см. docker/nginx/default.conf):
// inline-<script> в blade блокировался браузером («Executing inline script
// violates … Content-Security-Policy») и телевизор не опрашивал API.
// Решение: после рендера вычисляем sha256 текста скрипта и добавляем его
// хэш в заголовок CSP этого ответа. Директивы берём из конфига nginx, чтобы
// политики не разъезжались при правках.
function tvScreenResponse(array $data, int $status = 200): \Symfony\Component\HttpFoundation\Response
{
    $html = view('tv-screen', $data)->render();

    // ВАЖНО: 'unsafe-inline' здесь обязателен. Браузер объединяет ВСЕ
    // CSP-заголовки ответа (nginx + Laravel) пересечением директив: если
    // хотя бы одна политика запрещает инлайн-скрипт, он блокируется, и
    // хэши sha256 из другой политики не спасают. Синтаксис 'unsafe-inline'
    // игнорируется только там, где есть nonce или hash — поэтому держим и
    // 'unsafe-inline', и хэш ниже: экран работает при любом раскладе.
    $csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';"
        . " img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none';"
        . " frame-ancestors 'self'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:";

    if (preg_match_all('#<script[^>]*>(.*?)</script>#s', $html, $m)) {
        $hashes = [];
        foreach ($m[1] as $js) {
            $hashes[] = "'sha256-" . base64_encode(hash('sha256', $js, true)) . "'";
        }
        // Вставляем хэши сразу после 'self' в script-src.
        $csp = str_replace("script-src 'self'", "script-src 'self' " . implode(' ', $hashes), $csp);
    }

    return response($html, $status)
        ->header('Content-Type', 'text/html; charset=utf-8')
        ->header('Cache-Control', 'no-store')
        ->header('Content-Security-Policy', $csp);
}

// Редирект со «старого» короткого формата /m/{id} на вечную ссылку API
// (используется в QR/уведомлениях, если кто-то ввёл адрес вручную).
Route::redirect('/m/{meeting}', '/api/m/{meeting}')->whereNumber('meeting');
