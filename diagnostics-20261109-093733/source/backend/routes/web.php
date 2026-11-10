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
Route::get('/tv/{room}/all', function (string $room) {
    $q = \App\Models\Room::where('is_active', true);
    if (ctype_digit($room)) {
        $q->where(fn ($w) => $w->where('id', (int) $room)->orWhere('name', urldecode($room)));
    } else {
        $q->where('name', urldecode($room));
    }
    $model = $q->first();
    $token = (string) request()->query('token', '');
    $ok = $model && $token !== '' && $model->tv_token && hash_equals((string) $model->tv_token, $token);
    if (!$ok) {
        return response()->view('tv-all-meetings', ['roomName' => $model?->name ?? 'Зал', 'roomId' => $model?->id, 'token' => '', 'invalid' => true], 403)
            ->header('Content-Type', 'text/html; charset=utf-8')->header('Cache-Control', 'no-store');
    }
    return response()->view('tv-all-meetings', ['roomName' => $model->name, 'roomId' => $model->id, 'token' => $token, 'invalid' => false])
        ->header('Content-Type', 'text/html; charset=utf-8')->header('Cache-Control', 'no-store');
})->where('room', '[^/]+');

Route::get('/tv/{room}', function (string $room) {
    // Резолвим ПО НАЗВАНИЮ: телевизор открывает человекочитаемый адрес
    // /tv/Переговорная%20А%20(3%20этаж)?token=..., а не id.
    // Если зал не найден или выключен — отдаём экран с понятным сообщением
    // (не 404-заглушку Laravel: на ТВ она выглядит как «белая страница»).
    // Резолвим и по id, и по названию: предпросмотр в админке строит URL
    // /tv/{id}, а телевизоры — /tv/{название}. Оба варианта должны работать.
    $q = \App\Models\Room::where('is_active', true);
    if (ctype_digit($room)) {
        $q->where(fn ($w) => $w->where('id', (int) $room)->orWhere('name', urldecode($room)));
    } else {
        $q->where('name', urldecode($room));
    }
    $model = $q->first();
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
// Защита от «Cannot redeclare function tvScreenResponse()»: Laravel кэширует
// маршруты (artisan route:cache / package:discover), и при повторном включении
// этого файла в том же процессе (или при сборке кэша поверх уже загруженного
// web.php) без guards объявление функции выполнится дважды.
if (!function_exists('tvScreenResponse')) {
function tvScreenResponse(array $data, int $status = 200): \Symfony\Component\HttpFoundation\Response
{
    $html = view('tv-screen', $data)->render();

    // ВАЖНО про CSP: браузер объединяет ВСЕ CSP-заголовки ответа (nginx +
    // Laravel) пересечением директив: если хотя бы одна политика запрещает
    // инлайн-скрипт, он блокируется, и хэши sha256 из другой политики не
    // спасают. Поэтому nginx для /tv/ отдаёт ровно один CSP со 'unsafe-inline'
    // (см. docker/nginx/default.conf), а здесь мы НЕ добавляем второй CSP.
    // Хэши sha256 в script-src больше не вставляются намеренно: по спецификации
    // CSP3 наличие любого 'sha256-' источника полностью ОТКЛЮЧАЕТ 'unsafe-inline'
    // в этой же политике («Note that 'unsafe-inline' is ignored if either a hash
    // or nonce value is present» — так браузер и предупреждал). Инлайн-скрипт
    // экрана разрешён единственной политикой через 'unsafe-inline'.
    $csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline';"
        . " img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none';"
        . " frame-src 'self' https://salutejazz.ru; frame-ancestors 'self' https://salutejazz.ru; base-uri 'self'; form-action 'self'; worker-src 'self' blob:";

    return response($html, $status)
        ->header('Content-Type', 'text/html; charset=utf-8')
        ->header('Cache-Control', 'no-store')
        ->header('Content-Security-Policy', $csp);
}
} // if (!function_exists('tvScreenResponse'))

// Редирект со «старого» короткого формата /m/{id} на вечную ссылку API
// (используется в QR/уведомлениях, если кто-то ввёл адрес вручную).
Route::redirect('/m/{meeting}', '/api/m/{meeting}')->whereNumber('meeting');
