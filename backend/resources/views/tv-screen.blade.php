<!doctype html>
{{-- Пункт 5 плана: «экран ожидания» в зале. Открывается телевизором один раз:
     /tv/{название зала}?token={rooms.tv_token}. Без логина, токен только читает
     нейтральные поля расписания этого зала (см. TvScreenController::next).
     JS опрашивает API каждые 10 секунд; за 2 минуты до старта — полноэкранное
     приглашение; в момент старта — автопереход по «вечной» ссылке /api/m/{id},
     которая всегда ведёт на актуальную комнату ВКС. --}}
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Экран зала — ВКС</title>
    <style>
        :root { color-scheme: dark }
        * { box-sizing: border-box }
        body { font-family: system-ui, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; min-height: 100vh }
        .wrap { max-width: 900px; margin: 0 auto; padding: 3rem 2rem }
        header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap }
        h1 { font-size: 1.6rem; margin: 0 }
        .clock { font-size: 3.4rem; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; margin: 2.2rem 0 .4rem }
        .date { text-align: center; color: #94a3b8; margin-bottom: 2rem }
        ul.list { list-style: none; padding: 0; margin: 0; display: grid; gap: .6rem }
        ul.list li { background: #1e293b; border-radius: 12px; padding: .9rem 1.2rem; display: flex; justify-content: space-between; gap: 1rem }
        .time { color: #38bdf8; font-variant-numeric: tabular-nums; white-space: nowrap }
        .empty { color: #64748b; text-align: center; margin-top: 2rem }
        /* Полноэкранное приглашение (за 2 минуты до старта) */
        .invite { position: fixed; inset: 0; background: linear-gradient(160deg, #0c1730, #12335c); display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; z-index: 10 }
        .invite.on { display: flex }
        .invite .t { font-size: 2.6rem; font-weight: 800; margin: 0 0 1rem }
        .invite .cd { font-size: 4.6rem; font-weight: 800; color: #38bdf8; font-variant-numeric: tabular-nums }
        .invite .sub { color: #94a3b8; margin-top: 1rem; font-size: 1.2rem }
        .badge { position: fixed; left: 1rem; bottom: 1rem; color: #475569; font-size: .8rem }
    </style>
</head>
<body>
<div class="wrap">
    @isset($missing)
        {{-- Зал не найден в справочнике (переименован/удалён) или выключен.
             Показываем понятную заглушку вместо «вечного» экрана с ошибкой. --}}
        <h1 id="room">Зал не найден</h1>
        <p class="empty" style="display:block">
            Экран открыт по адресу «{!! e(urldecode($room)) !!}», но такого активного зала
            в справочнике нет.<br><br>
            Проверьте название в <b>Админ-панели → Комнаты</b> и заново скопируйте
            ссылку «Экран ТВ» — после переименования зала старый адрес телевизора
            перестаёт работать.
        </p>
    @else
        <header>
            <h1 id="room">…</h1>
            <div id="status" class="time"></div>
        </header>
        <div class="clock" id="clock">--:--:--</div>
        <div class="date" id="today"></div>
        <ul class="list" id="upcoming"></ul>
        <div class="empty" id="empty" style="display:none">Свободно. Следующая встреча появится здесь автоматически.</div>
    @endisset
</div>

<div class="invite" id="invite">
    <p class="t" id="inviteTitle"></p>
    <div class="cd" id="inviteCd"></div>
    <p class="sub" id="inviteSub">Подключение начнётся автоматически…</p>
</div>
<div class="badge">Экран зала · обновление каждые 10 с</div>

{{-- Экран рендерится nginx-ом с жёстким CSP (см. docker/nginx/default.conf,
     location ~ ^/tv/), где script-src запрещает inline-скрипты. Поэтому этот
     <script> разрешается CSP-хэшем: хэш текста скрипта вычисляется в
     routes/web.php после рендера blade и добавляется в заголовок
     Content-Security-Policy ответа ('sha256-...'). --}}
@if(config('broadcasting.connections.reverb.app_key'))
{{-- pusher-js кладётся локально (CSP script-src 'self'): cp backend/public/js/pusher.min.js --}}
<script src="/js/pusher.min.js" onerror="window.__noPusher=1"></script>
@endif
<script>
(function () {
    var ROOM = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
    var TOKEN = new URLSearchParams(location.search).get('token') || '';
    // Идентификатор экземпляра экрана для журнала посещаемости (tv_view_logs):
    // переживает перезагрузку страницы в sessionStorage, уникален на ТВ.
    var SCREEN_ID = (function () {
        try {
            var s = sessionStorage.getItem('vks_tv_screen');
            if (!s) { s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('vks_tv_screen', s); }
            return s;
        } catch (e) { return 'tv'; }
    })();
    // Сегмент для API-поллинга: серверный маршрут /api/tv/{room}/next резолвит
    // зал и по id, и по названию — но страница /tv/ всегда отдаётся только для
    // СУЩЕСТВУЮЩИХ активных залов (см. routes/web.php), поэтому берём точный
    // id из blade ($roomId): он не зависит от кодировки скобок/пробелов в URL.
    var ROOM_API = @json(isset($roomId) ? (string) $roomId : ROOM);
@if(isset($missing))
    // Заглушка «Зал не найден»: поллинг не нужен — зала в справочнике нет.
    return;
@elseif(isset($tvTokenOk) && !$tvTokenOk)
    // Токен в URL отсутствует или не совпадает с rooms.tv_token — поллинг
    // вернул бы 403, поэтому сразу показываем понятную инструкцию.
    document.addEventListener('DOMContentLoaded', function () {
        var el = document.getElementById('status');
        if (el) el.textContent = 'Неверный токен экрана';
        var empty = document.getElementById('empty');
        if (empty) {
            empty.style.display = 'block';
            empty.innerHTML = 'Телевизор открыт по адресу без токена (или токен устарел).<br><br>' +
                'Скопируйте актуальную ссылку в <b>Админ-панель → Комнаты → Экран ТВ</b> ' +
                'и заново откройте её на телевизоре.';
        }
    });
@endif
    var POLL_MS = 10000, INVITE_BEFORE = 120000; // приглашение за 2 минуты
    var nextMeeting = null, serverOffset = 0, joined = false;

    function now() { return new Date(Date.now() + serverOffset); }
    function hhmm(iso) { var d = new Date(new Date(iso).getTime() - serverOffset); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }

    // Часы: локальное время + синхронизация с сервером при каждом поллинге
    setInterval(function () {
        var t = now();
        document.getElementById('clock').textContent =
            ('0'+t.getHours()).slice(-2)+':'+('0'+t.getMinutes()).slice(-2)+':'+('0'+t.getSeconds()).slice(-2);
        document.getElementById('today').textContent =
            t.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    }, 500);

    function renderList(rows) {
        var ul = document.getElementById('upcoming');
        ul.innerHTML = '';
        rows.forEach(function (m) {
            var li = document.createElement('li');
            var n = document.createElement('span'); n.textContent = m.title;
            var s = document.createElement('span'); s.className = 'time'; s.textContent = hhmm(m.start) + '–' + hhmm(m.end);
            li.appendChild(n); li.appendChild(s); ul.appendChild(li);
        });
        document.getElementById('empty').style.display = rows.length ? 'none' : 'block';
    }

    function tickInvite() {
        var box = document.getElementById('invite'), cd = document.getElementById('inviteCd');
        if (!nextMeeting || joined) { box.classList.remove('on'); return; }
        var msLeft = new Date(nextMeeting.start).getTime() - now().getTime();
        if (msLeft <= 0 && now().getTime() < new Date(nextMeeting.end).getTime()) {
            // Момент старта: сам открываем «вечную» ссылку (редирект на живую комнату)
            joined = true;
            document.getElementById('inviteSub').textContent = 'Подключаемся к встрече…';
            location.href = nextMeeting.join_url; // уже полный путь /api/m/{id}
            return;
        }
        if (msLeft > 0 && msLeft <= INVITE_BEFORE) {
            document.getElementById('inviteTitle').textContent = 'Через 2 мин: ' + nextMeeting.title;
            cd.textContent = Math.max(0, Math.ceil(msLeft / 1000)) + ' с';
            box.classList.add('on');
        } else {
            box.classList.remove('on');
        }
    }
    setInterval(tickInvite, 1000);

    function poll() {
        fetch('/api/tv/' + encodeURIComponent(ROOM_API) + '/next?token=' + encodeURIComponent(TOKEN) + '&screen=' + encodeURIComponent(SCREEN_ID), { headers: { Accept: 'application/json' } })
            .then(function (r) {
                if (r.status === 403) throw new Error('Неверный токен экрана');
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (j) {
                serverOffset = new Date(j.server_time).getTime() - Date.now();
                document.getElementById('room').textContent = j.room.name;
                document.getElementById('status').textContent = j.next ? 'Далее: ' + j.next.title + ' в ' + hhmm(j.next.start) : '';
                nextMeeting = j.next || null;
                if (nextMeeting && new Date(nextMeeting.start).getTime() > now().getTime()) joined = false;
                renderList(j.upcoming || []);
            })
            .catch(function (e) { document.getElementById('status').textContent = e.message; });
    }
    poll();
    setInterval(poll, POLL_MS);

    @if(config('broadcasting.connections.reverb.app_key'))
    // --- WebSocket (Laravel Reverb): мгновенное обновление экрана при изменениях расписания.
    // Событие транслируется в канал vks.room.{id} (Broadcast::channel, auth = csrf-токен).
    // При обрыве соединения поллинг каждые 60 с работает как резервный канал.
    if (typeof Pusher === 'undefined') { /* библиотека не загрузилась — остаёмся на поллинге */ }
    else try {
        var wsHost = @json(env('REVERB_HOST', request()->getHost()));
        var wsPort = parseInt(@json(env('REVERB_PORT', 8080)), 10);
        var useTls = location.protocol === 'https:';
        var chanName = 'vks-public.room.' + ROOM_API;
        var pusher = new Pusher(@json(config('broadcasting.connections.reverb.app_key')), {
            wsHost: wsHost, wsPort: wsPort, wssPort: wsPort, forceTLS: useTls,
            enableStats: false, enabledTransports: useTls ? ['wss'] : ['ws'],
            // Публичный канал vks-public.room.{id} — авторизация не нужна.
            authorizer: { subscribe: function (cb) { cb({}); }, unsubscribe: function () {}, error: function () {} }
        });
        var channel = pusher.subscribe(chanName);
        channel.bind('.MeetingUpdated', function () { poll(); });
        pusher.connection.bind('connected', function () { clearInterval(window.__tvPoll); window.__tvPoll = setInterval(poll, 60000); });
        pusher.connection.bind('disconnected', function () { clearInterval(window.__tvPoll); window.__tvPoll = setInterval(poll, POLL_MS); });
    } catch (e) { /* нет WS — остаёмся на обычном поллинге */ }
    @endif

    // Автоперезагрузка экрана (защита от «текущих» ТВ-браузеров): раз в 6 часов
    // в интервале 03:00–04:59 по серверному времени — тихие часы, когда
    // встреч почти нет. Флаг sessionStorage не нужен: перезагрузка полная.
    var RELOAD_HOURS = 6;
    var lastReloadCheck = Date.now();
    setInterval(function () {
        if (Date.now() - lastReloadCheck < RELOAD_HOURS * 3600000) return;
        var h = now().getHours();
        if (h >= 3 && h < 5) { lastReloadCheck = Date.now(); location.reload(); }
    }, 60000);
})();
</script>
</body>
</html>
