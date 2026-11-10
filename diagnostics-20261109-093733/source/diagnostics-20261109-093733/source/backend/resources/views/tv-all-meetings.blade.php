<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Все ВКС — {{ $roomName }}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,"Segoe UI",sans-serif}.wrap{max-width:1100px;margin:0 auto;padding:2rem}header{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}h1{font-size:1.8rem;margin:.2rem 0}.muted{color:#94a3b8}.back,.join{display:inline-block;text-decoration:none;border-radius:10px;padding:.65rem 1rem;background:#334155;color:#fff;font-weight:650}.group{margin-top:1.6rem}.day{font-size:1.15rem;color:#7dd3fc;margin:0 0 .6rem}.item{background:#1e293b;border-radius:12px;padding:1rem 1.2rem;margin:.55rem 0;display:flex;justify-content:space-between;align-items:center;gap:1rem}.title{font-weight:700}.time{white-space:nowrap;color:#38bdf8;font-variant-numeric:tabular-nums}.join{background:#0284c7;margin-left:1rem}.empty{padding:2rem;text-align:center;color:#94a3b8}.error{padding:2rem;text-align:center;color:#fca5a5}@media(max-width:650px){.wrap{padding:1rem}.item{align-items:flex-start;flex-direction:column}.join{margin:0}}
</style></head>
<body><main class="wrap">
<header><div><div class="muted">Расписание помещения</div><h1>{{ $roomName }} — все ВКС</h1><div class="muted" id="updated">Загрузка расписания…</div></div><a class="back" href="{{ url('/tv/' . ($roomId ?? '')) }}?token={{ urlencode((string)$token) }}">← На экран зала</a></header>
@if($invalid)
<div class="error">Нет доступа: токен экрана неверный или устарел. Скопируйте актуальную ссылку в админ-панели → Комнаты.</div>
@else
<div id="content"><div class="empty">Загружаем конференции…</div></div>
@endif
</main>
@if(!$invalid)
<script>
(function(){
 const roomId=@json((string)$roomId), token=@json((string)$token), root=document.getElementById('content');
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function dateText(raw){const p=String(raw||'').slice(0,10).split('-');if(p.length!==3)return '';const d=new Date(+p[0],+p[1]-1,+p[2],12);return d.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
 function timeText(iso){const d=new Date(iso);return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}
 async function load(){try{const r=await fetch('/api/tv/'+encodeURIComponent(roomId)+'/all?token='+encodeURIComponent(token),{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();const rows=j.meetings||[];document.getElementById('updated').textContent='Обновлено: '+new Date(j.server_time).toLocaleTimeString('ru-RU');if(!rows.length){root.innerHTML='<div class="empty">Предстоящих ВКС на ближайшие 30 дней нет.</div>';return;}let html='',last='';for(const m of rows){if(m.date!==last){last=m.date;html+='<section class="group"><h2 class="day">'+esc(dateText(m.date))+'</h2>';}html+='<article class="item"><div><div class="title">'+esc(m.title)+'</div><div class="muted">'+esc(m.live?'Сейчас идёт':'Запланирована')+'</div></div><div><span class="time">'+esc(timeText(m.start))+'–'+esc(timeText(m.end))+'</span> <a class="join" href="'+esc(m.join_url)+'">Открыть ВКС</a></div></article>'; }root.innerHTML=html;}catch(e){root.innerHTML='<div class="error">Не удалось загрузить расписание: '+esc(e.message)+'</div>';}}
 load();setInterval(load,30000);
})();
</script>
@endif
</body></html>
