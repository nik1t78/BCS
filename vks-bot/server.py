# -*- coding: utf-8 -*-
"""HTTP-обёртка над VKS-ботом (FastAPI).

Запуск:  uvicorn server:app --host 0.0.0.0 --port 8090   (или python server.py)

Движок браузера выбирается переменной окружения VKSBOT_ENGINE:
  playwright (по умолчанию) — bot_pw.VkxBotPlaywright, вход на сайт без логина;
  selenium                  — старый движок bot.VkxBot (запасной вариант).

Эндпоинты:
  GET  /health           -> {"ok": true}
  POST /create           body {"title": "...", "name": "..."}
  POST /create-link      — то же, псевдоним /create (для фронтенда)
  POST /check-and-create — проверка и создание: если передана существующая
        link и её комната отвечает (HEAD-запрос), ссылка возвращается как есть
        (reused:true); иначе создаётся новая через бота.
        -> {"ok": true, "link": "https://salutejazz.ru/calls/xxx?psw=YYY", ...}
        При сбое возвращается ok:false без фиктивной ссылки.
Доступ ограничен списком токенов из переменной окружения BOT_TOKENS
("секрет1,секрет2") — запросы без заголовка "X-Bot-Token" отклоняются (401).
"""
from datetime import datetime, timedelta, timezone

import asyncio
from concurrent.futures import Future
from queue import Queue, Full
import threading
import secrets
import logging
import os
import re

import urllib.request
import urllib.error

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [vks-bot-server] %(message)s")
log = logging.getLogger("vks-bot-server")

ENGINE = os.getenv("VKSBOT_ENGINE", "playwright").strip().lower()
if ENGINE == "selenium":
    from bot import VkxBot as _BotImpl
    log.info("Движок VKS-бота: Selenium (bot.py)")
else:
    from bot_pw import VkxBotPlaywright as _BotImpl
    ENGINE = "playwright"
    log.info("Движок VKS-бота: Playwright (bot_pw.py)")

app = FastAPI(title=f"VKS Bot ({ENGINE})", version="1.1")
# Playwright Sync API привязан к потоку. Поэтому каждый worker создаёт
# собственный экземпляр бота/Chromium в своём потоке и переиспользует его.
# Так несколько конференций создаются одновременно без совместного доступа
# к одной странице/контексту браузера.
BOT_CONCURRENCY = max(1, min(int(os.getenv("VKSBOT_CONCURRENCY", "2")), 4))
BOT_QUEUE_LIMIT = max(1, int(os.getenv("VKSBOT_QUEUE_LIMIT", "20")))
ALLOWED_TOKENS = {t.strip() for t in os.getenv("BOT_TOKENS", "").split(",") if t.strip()}


class BotWorkerPool:
    def __init__(self, size: int, queue_limit: int):
        self.size = size
        self.jobs: Queue = Queue(maxsize=queue_limit)
        self.threads: list[threading.Thread] = []
        self.active = 0
        self._active_lock = threading.Lock()
        self.started = False

    def start(self):
        if self.started:
            return
        self.started = True
        for index in range(self.size):
            thread = threading.Thread(target=self._worker, args=(index + 1,),
                                      name=f"vks-bot-worker-{index + 1}", daemon=True)
            thread.start()
            self.threads.append(thread)
        log.info("Пул бота запущен: workers=%s queue_limit=%s", self.size, self.jobs.maxsize)

    def _worker(self, worker_id: int):
        worker_bot = _BotImpl(headless=os.getenv("BOT_HEADLESS", "1") != "0")
        log.info("Bot worker %s готов", worker_id)
        try:
            while True:
                item = self.jobs.get()
                if item is None:
                    self.jobs.task_done()
                    break
                fn, args, future = item
                if future.set_running_or_notify_cancel():
                    with self._active_lock:
                        self.active += 1
                    started = __import__("time").monotonic()
                    try:
                        future.set_result(fn(worker_bot, *args))
                    except BaseException as exc:
                        future.set_exception(exc)
                    finally:
                        elapsed = (__import__("time").monotonic() - started) * 1000
                        with self._active_lock:
                            self.active -= 1
                        log.info("Bot worker %s завершил задачу за %.0f мс", worker_id, elapsed)
                self.jobs.task_done()
        finally:
            close = getattr(worker_bot, "close", None)
            if callable(close):
                try:
                    close()
                except Exception:
                    log.exception("Ошибка закрытия браузера worker %s", worker_id)
            log.info("Bot worker %s остановлен", worker_id)

    def submit(self, fn, *args) -> Future:
        if not self.started:
            self.start()
        future = Future()
        try:
            self.jobs.put_nowait((fn, args, future))
        except Full:
            raise HTTPException(status_code=503, detail="Очередь создания ВКС заполнена. Повторите попытку через минуту.")
        return future

    def shutdown(self):
        if not self.started:
            return
        for _ in self.threads:
            self.jobs.put(None)
        for thread in self.threads:
            thread.join(timeout=30)
        self.threads.clear()
        self.started = False


worker_pool = BotWorkerPool(BOT_CONCURRENCY, BOT_QUEUE_LIMIT)


class CreateReq(BaseModel):
    title: str = Field(default="Встреча", max_length=120)
    name: str = Field(default="Организатор", max_length=80)
    # Дата встречи «ДД.ММ.ГГГГ» (или ISO «ГГГГ-ММ-ДД») — бот пишет её в
    # название комнаты, чтобы на платформе встреча стояла нужным числом,
    # а не «уезжала» на день назад из-за часового пояса сервера.
    date: str | None = Field(default=None, max_length=32)


class CheckAndCreateReq(CreateReq):
    link: str | None = Field(default=None, max_length=500)


def _normalize_date(raw: str | None) -> str | None:
    """Привести дату к «ДД.ММ.ГГГГ»; None, если распознать не удалось."""
    if not raw:
        return None
    s = str(raw).strip()[:32]
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)  # ISO из Laravel/фронта
    if m:
        return f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
    m = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$", s)
    if m:
        y = m.group(3) if len(m.group(3)) == 4 else "20" + m.group(3)
        return f"{int(m.group(1)):02d}.{int(m.group(2)):02d}.{y}"
    return None


def _check_token(token: str | None):
    # Fail closed: пустой BOT_TOKENS — ошибка конфигурации, а не публичный доступ.
    if not ALLOWED_TOKENS:
        raise HTTPException(status_code=503, detail="BOT_TOKENS is not configured")
    if not token or not any(secrets.compare_digest(token, allowed) for allowed in ALLOWED_TOKENS):
        raise HTTPException(status_code=401, detail="Bad or missing X-Bot-Token")


def _room_alive(link: str, timeout: float = 6.0) -> bool:
    """HEAD-запрос к комнате: True, если страница встречи отвечает (не 404/410)."""
    m = re.search(r"https://salutejazz\.ru/calls/[A-Za-z0-9_-]+", link or "")
    if not m:
        return False
    url = m.group(0)
    if url.rstrip("/").endswith("/create"):
        return False
    req = urllib.request.Request(url, method="HEAD",
                                 headers={"User-Agent": "vks-bot/1.1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status < 400
    except urllib.error.HTTPError:
        # 4xx/5xx — комната мертва или сервер недоступен
        return False
    except Exception:
        # Таймаут — не уверены, что ссылка жива; создаём новую (ссылки на
        # несуществующую комнату дают «битые» приглашения хуже, чем дубль).
        return False


@app.get("/health")
def health():
    if not ALLOWED_TOKENS:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "service": f"vks-{ENGINE}-bot", "error": "BOT_TOKENS is not configured"},
        )
    with worker_pool._active_lock:
        active = worker_pool.active
    return {"ok": True, "service": f"vks-{ENGINE}-bot",
            "workers": BOT_CONCURRENCY, "active": active,
            "queued": worker_pool.jobs.qsize()}


@app.on_event("startup")
async def startup_bot():
    if not ALLOWED_TOKENS:
        log.error("BOT_TOKENS не настроен: browser workers не запускаются")
        return
    worker_pool.start()


@app.on_event("shutdown")
async def shutdown_bot():
    """Закрыть каждый Chromium в том же потоке, где он был создан."""
    await asyncio.to_thread(worker_pool.shutdown)


# Тот же ответ на "/" — чтобы работала проверка без префикса /vks-bot
# (напрямую http://localhost:8090/ или через nginx при любом варианте
# проксирования пути). Также добавлен алиас /vks-bot/health — защита от
# конфигураций nginx без завершающего слэша в proxy_pass.
@app.get("/")
def root():
    return {"ok": True, "service": f"vks-{ENGINE}-bot", "endpoints": ["/health", "/create", "/create-link", "/check-and-create"]}


@app.get("/vks-bot/health")
def health_prefixed():
    return health()


def _do_create(bot_instance, title: str, name: str, date: str | None = None) -> dict:
    """Единая логика создания: реальная комната или явная ошибка.

    date («ДД.ММ.ГГГГ» или ISO) — передаётся боту как выбранная дата
    комнаты; если не передана — берём СЕГОДНЯШНЮЮ дату по Москве (+03:00),
    а не локальные часы контейнера: при жизни бота в UTC вечерний запрос
    (после 21:00 MSK) давал «вчера» — встреча записывалась на 28 число
    вместо 29.
    """
    d = _normalize_date(date)
    if d is None:
        msk = timezone(timedelta(hours=3))
        d = datetime.now(msk).strftime("%d.%m.%Y")
        log.info("Дата встречи не передана — беру сегодняшнюю по МСК: %s", d)
    # Дата НЕ дописывается в название комнаты: платформа salutejazz.ru никак
    # не использует текст названия для расписания встречи (комната живёт
    # «сегодня»), а пользователь просил убрать дату из отображаемого
    # заголовка. Дата возвращается в поле «date» ответа — её видно во фронтенде.
    log.info("Запрос на создание ВКС: title=%r name=%r date=%r", title, name, d)
    result = bot_instance.create_call(title, name, date=d)
    if not result.get("ok"):
        # Не генерируем фиктивную ссылку: случайный URL не соответствует
        # реально созданной комнате SaluteJazz и вводит пользователя в заблуждение.
        result.pop("fallback_link", None)
        result["fallback_note"] = "Комната SaluteJazz не создана. Повторите попытку после устранения ошибки бота."
    # Дата встречи в явном виде — и в успешном, и в fallback-ответе, чтобы
    # клиент (Laravel/фронт) видел, каким числом записана комната.
    result.setdefault("date", d)
    return result


@app.post("/create")
async def create(req: CreateReq, x_bot_token: str | None = Header(default=None)):
    _check_token(x_bot_token)
    future = worker_pool.submit(_do_create, req.title, req.name, req.date)
    return await asyncio.wrap_future(future)


# Псевдоним /create под именем /create-link — фронтенд (vksBot.ts) и
# документация называют эндпоинт «создать ссылку».
@app.post("/create-link")
async def create_link(req: CreateReq, x_bot_token: str | None = Header(default=None)):
    _check_token(x_bot_token)
    future = worker_pool.submit(_do_create, req.title, req.name, req.date)
    return await asyncio.wrap_future(future)


def _check_and_create_sync(bot_instance, req: CheckAndCreateReq) -> dict:
    if req.link and _room_alive(req.link):
        log.info("Ссылка %r жива — переиспользуем без создания новой", req.link)
        return {"ok": True, "reused": True, "link": req.link}
    result = _do_create(bot_instance, req.title, req.name, req.date)
    result.setdefault("reused", False)
    return result


@app.post("/check-and-create")
async def check_and_create(req: CheckAndCreateReq,
                           x_bot_token: str | None = Header(default=None)):
    """Переиспользовать живую ссылку или создать новую в выделенном потоке."""
    _check_token(x_bot_token)
    future = worker_pool.submit(_check_and_create_sync, req)
    return await asyncio.wrap_future(future)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("BOT_PORT", "8090")))
