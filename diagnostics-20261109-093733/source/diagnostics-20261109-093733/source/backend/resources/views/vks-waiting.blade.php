<!doctype html>
{{-- Пункт 2 плана: страница-«ждалка» для вечной ссылки /api/m/{id}, когда комната
     ещё не готова (бот/очередь её создают). Автообновление каждые 15 секунд. --}}
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="15">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $meeting->title }} — подготовка ссылки</title>
    <style>
        body { font-family: system-ui, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0 }
        .card { text-align:center; padding:2rem 3rem; background:#1e293b; border-radius:16px; max-width:480px }
        h1 { font-size:1.3rem; margin:0 0 .5rem }
        p { color:#94a3b8; margin:.3rem 0 }
        .spin { width:42px; height:42px; margin:1rem auto; border:4px solid #334155; border-top-color:#38bdf8; border-radius:50%; animation:r 1s linear infinite }
        @keyframes r { to { transform:rotate(360deg) } }
    </style>
</head>
<body>
<div class="card">
    <div class="spin"></div>
    <h1>{{ $meeting->title }}</h1>
    <p>Ссылка на видеоконференцию готовится ботом.</p>
    <p>Страница обновится автоматически…</p>
</div>
</body>
</html>
