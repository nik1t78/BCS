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
        При сбое бота — ok:false + локально сгенерированная ссылка в field "fallback_link".
Доступ ограничен списком токенов из переменной окружения BOT_TOKENS
("секрет1,секрет2") — запросы без заголовка "X-Bot-Token" отклоняются (401).
"""
from datetime import datetime, timedelta, timezone

import logging
import os
import random
import re
import string

import urllib.request
import urllib.error

from fastapi import FastAPI, Header, HTTPException
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

# fallback_local_link не зависит от движка — своя копия, чтобы Playwright-режим
# не требовал установленный selenium (импорт bot.py тянет за собой его).
def fallback_local_link() -> str:
    """Локальная генерация ссылки в эталонном формате (если бот недоступен)."""
    rnd = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    psw = "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    return f"https://salutejazz.ru/calls/{rnd}?psw={psw}"

app = FastAPI(title=f"VKS Bot ({ENGINE})", version="1.1")
bot = _BotImpl(headless=os.getenv("BOT_HEADLESS", "1") != "0")

ALLOWED_TOKENS = {t.strip() for t in os.getenv("BOT_TOKENS", "").split(",") if t.strip()}


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
    # Если токены не настроены — открыто только для localhost-деплоя; на проде задайте BOT_TOKENS
    if ALLOWED_TOKENS and token not in ALLOWED_TOKENS:
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
    return {"ok": True, "service": f"vks-{ENGINE}-bot"}


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


def _do_create(title: str, name: str, date: str | None = None) -> dict:
    """Единая логика создания: вызов бота + fallback-ссылка при сбое.

    date («ДД.ММ.ГГГГ» или ISO) — передаётся боту и пишется в название
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
    result = bot.create_call(title, name, date=d)
    if not result.get("ok"):
        result["fallback_link"] = fallback_local_link()
        result["fallback_note"] = "Бот не смог создать встречу — используйте fallback-ссылку (формат платформы)."
    # Дата встречи в явном виде — и в успешном, и в fallback-ответе, чтобы
    # клиент (Laravel/фронт) видел, каким числом записана комната.
    result.setdefault("date", d)
    return result


@app.post("/create")
def create(req: CreateReq, x_bot_token: str | None = Header(default=None)):
    _check_token(x_bot_token)
    return _do_create(req.title, req.name, req.date)


# Псевдоним /create под именем /create-link — фронтенд (vksBot.ts) и
# документация называют эндпоинт «создать ссылку».
@app.post("/create-link")
def create_link(req: CreateReq, x_bot_token: str | None = Header(default=None)):
    _check_token(x_bot_token)
    return _do_create(req.title, req.name, req.date)


@app.post("/check-and-create")
def check_and_create(req: CheckAndCreateReq,
                     x_bot_token: str | None = Header(default=None)):
    """Проверить существующую ссылку и создать новую только при её отсутствии.

    Тело: {title, name, link?}. Если link жив (комната отвечает) — возвращаем
    его как есть с reused=true (дубли не плодим). Иначе создаём через бота.
    """
    _check_token(x_bot_token)
    if req.link and _room_alive(req.link):
        log.info("Ссылка %r жива — переиспользуем без создания новой", req.link)
        return {"ok": True, "reused": True, "link": req.link}
    result = _do_create(req.title, req.name, req.date)
    result.setdefault("reused", False)
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("BOT_PORT", "8090")))
