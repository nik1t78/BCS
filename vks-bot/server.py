# -*- coding: utf-8 -*-
"""HTTP-обёртка над VKS-ботом (FastAPI).

Запуск:  uvicorn server:app --host 0.0.0.0 --port 8090   (или python server.py)

Эндпоинты:
  GET  /health           -> {"ok": true}
  POST /create           body {"title": "...", "name": "..."}
        -> {"ok": true, "link": "https://salutejazz.ru/calls/xxx?psw=YYY", ...}
        При сбое бота — ok:false + локально сгенерированная ссылка в field "fallback_link".
Доступ ограничен списком токенов из переменной окружения BOT_TOKENS
("секрет1,секрет2") — запросы без заголовка "X-Bot-Token" отклоняются (401).
"""
import logging
import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from bot import VkxBot, fallback_local_link

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [vks-bot-server] %(message)s")
log = logging.getLogger("vks-bot-server")

app = FastAPI(title="VKS Selenium Bot", version="1.0")
bot = VkxBot(headless=os.getenv("BOT_HEADLESS", "1") != "0")

ALLOWED_TOKENS = {t.strip() for t in os.getenv("BOT_TOKENS", "").split(",") if t.strip()}


class CreateReq(BaseModel):
    title: str = Field(default="Встреча", max_length=120)
    name: str = Field(default="Организатор", max_length=80)


def _check_token(token: str | None):
    # Если токены не настроены — открыто только для localhost-деплоя; на проде задайте BOT_TOKENS
    if ALLOWED_TOKENS and token not in ALLOWED_TOKENS:
        raise HTTPException(status_code=401, detail="Bad or missing X-Bot-Token")


@app.get("/health")
def health():
    return {"ok": True, "service": "vks-selenium-bot"}


@app.post("/create")
def create(req: CreateReq, x_bot_token: str | None = Header(default=None)):
    _check_token(x_bot_token)
    log.info("Запрос на создание ВКС: title=%r name=%r", req.title, req.name)
    result = bot.create_call(req.title, req.name)
    if not result.get("ok"):
        result["fallback_link"] = fallback_local_link()
        result["fallback_note"] = "Бот не смог создать встречу — используйте fallback-ссылку (формат платформы)."
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("BOT_PORT", "8090")))
