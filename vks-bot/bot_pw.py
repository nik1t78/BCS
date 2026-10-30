# -*- coding: utf-8 -*-
"""
VKS-бот (Playwright): автоматически заходит на https://salutejazz.ru/calls/create
без логина, вводит название встречи и имя организатора, получает готовую ссылку.

Публичный API идентичен bot.py (Selenium), поэтому server.py может выбирать
движок через переменную окружения VKSBOT_ENGINE=playwright|selenium
(по умолчанию — playwright; Selenium остаётся как запасной).

Запуск напрямую (отладка одного создания):
    python bot_pw.py --title "Планёрка" --name "Иван Петров" [--headful]
"""
import argparse
import json
import logging
import os
import random
import re
import string
import threading
import time
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

CREATE_URL = os.getenv("VKSBOT_CREATE_URL", "https://salutejazz.ru/calls/create")
LINK_RE = re.compile(r"https://salutejazz\.ru/calls/[A-Za-z0-9_-]+(?:\?[^\s\"'<]*)?")

# Платформа salutejazz.ru НЕ имеет API планирования встреч: комната живёт
# «сегодня», и дата начала встречи задаётся только полем datetime-local
# в форме создания (если оно есть на странице). Ниже — попытка заполнить
# его передатанной датой; если поля нет, дата остаётся только в ответе API.


def _fill_datetime_fields(page, date_dmy: str | None) -> str:
    """Заполнить datetime/date-поля формы создания датой встречи.

    date_dmy — «ДД.ММ.ГГГГ». Возвращает статус для логов: 'filled', 'absent'
    или 'failed:…'. Значение пишется в нативном формате input[type=datetime]
    («ГГГГ-ММ-ДДTHH:MM») через React-совместимый сеттер.
    """
    if not date_dmy:
        return "absent"
    try:
        m = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})", date_dmy)
        if not m:
            return "absent"
        dd, mm, yyyy = m.groups()
        iso_date = f"{yyyy}-{mm}-{dd}"
        filled = page.evaluate(
            """([isoDate]) => {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value').set;
                let n = 0;
                for (const el of document.querySelectorAll('input')) {
                    const ty = (el.type || '').toLowerCase();
                    const nm = ((el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
                    const isDate = ['datetime-local', 'date'].includes(ty) ||
                        (ty === 'text' && /(дата|date)/.test(nm));
                    if (!isDate) continue;
                    const val = ty === 'datetime-local' ? isoDate + 'T09:00' : isoDate;
                    setter.call(el, val);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    n++;
                }
                return n;
            }""",
            [iso_date],
        )
        return "filled" if filled else "absent"
    except Exception as e:  # noqa: BLE001 — поле может быть недоступно, не фатально
        return f"failed:{e}"


log = logging.getLogger("vks-bot-playwright")


def _browser_channel() -> str | None:
    """Системный chromium из образа (как с Selenium), чтобы Playwright не
    требовал `playwright install` и не качал свой Chrome-for-Testing."""
    for name in ("chromium", "chromium-browser"):
        for path in (f"/usr/bin/{name}", f"/usr/bin/{name}-stable"):
            if os.path.exists(path):
                return path
    env_bin = os.getenv("CHROME_BIN") or os.getenv("PLAYWRIGHT_CHROMIUM_BIN")
    if env_bin and os.path.exists(env_bin):
        return env_bin
    return None  # падимся на собственный браузер Playwright


def _dismiss_overlays(page):
    """Закрыть всплывающие окна (разрешения, лицензии), перекрывающие форму."""
    closed = True
    while closed:
        closed = False
        try:
            texts = page.eval_on_selector_all(
                "button",
                "els => els.map(e => (e.textContent || '').trim().toLowerCase())",
            )
        except Exception:
            return
        for i, t in enumerate(texts):
            if t in ("later", "позже", "not now", "закрыть", "close",
                     "deny", "отклонить", "block", "заблокировать"):
                try:
                    page.eval_on_selector_all(
                        "button",
                        "(els, idx) => { if (els[idx]) els[idx].click(); }",
                        i,
                    )
                    log.info("Закрыт оверлей кнопкой %r", t)
                    closed = True
                    time.sleep(0.7)
                    break  # DOM мог перерисоваться — перечитываем список
                except Exception:
                    pass


class VkxBotPlaywright:
    """Одна «сессия» = один заход на salutejazz.ru. Потокобезопасно через lock."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self._lock = threading.Lock()

    @staticmethod
    def _set_value(page, el, text: str):
        """Надёжный ввод в React-поле: нативный setter + событие input.
        Не требует клика (страница SaluteJazz перекрывает поля оверлеями)."""
        page.evaluate(
            """
            ([el, text]) => {
                const proto = el.tagName === 'TEXTAREA'
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
                el.focus();
                setter.call(el, '');
                el.dispatchEvent(new Event('input', { bubbles: true }));
                setter.call(el, text);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            """,
            [el, text],
        )

    def _find_input(self, page, tries_css, timeout_ms: int = 4000):
        """Найти первое видимое текстовое поле из списка селекторов."""
        deadline = time.time() + timeout_ms / 1000
        while time.time() < deadline:
            for css in tries_css:
                try:
                    handle = page.query_selector(css)
                    if handle and handle.is_visible():
                        return handle, css
                except Exception:
                    continue
            time.sleep(0.3)
        return None, None

    def create_call(self, title: str, name: str, timeout: int = 60,
                    date: str | None = None) -> dict:
        """Создать встречу на SaluteJazz и вернуть ссылку.

        Возвращает: {"ok": True, "link": ..., "room": ..., "password": ...}
        либо      {"ok": False, "error": "..."}
        """
        title = (title or "Встреча").strip()[:120]
        name = (name or "Организатор").strip()[:80]

        with self._lock:
            pw = None
            browser = None
            page = None
            try:
                pw = sync_playwright().start()
                launch_kwargs = dict(
                    headless=self.headless,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--lang=ru-RU",
                        "--use-fake-ui-for-media-stream",
                        "--use-fake-device-for-media-stream",
                        "--autoplay-policy=no-user-gesture-required",
                    ],
                )
                channel = _browser_channel()
                if channel:
                    launch_kwargs["executable_path"] = channel
                else:
                    log.warning(
                        "Системный chromium не найден — Playwright использует "
                        "собственный браузер (нужен `playwright install chromium`)"
                    )
                browser = pw.chromium.launch(**launch_kwargs)
                context = browser.new_context(
                    locale="ru-RU",
                    viewport={"width": 1280, "height": 900},
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0 Safari/537.36"
                    ),
                    permissions=[],
                )
                # микрофон/камера не просим — страница не должна показывать диалоги
                context.clear_permissions()
                page = context.new_page()
                page.set_default_timeout(timeout * 1000)
                page.goto(CREATE_URL, wait_until="domcontentloaded",
                          timeout=45_000)

                # Ждём, пока SPA отрендерит форму (input или кнопку)
                page.wait_for_selector("input, textarea, button",
                                       timeout=timeout * 1000)
                time.sleep(1.5)  # догреваем React-форму
                _dismiss_overlays(page)

                def _form_ready() -> bool:
                    """Есть ли на странице видимое текстовое поле формы."""
                    try:
                        return bool(page.evaluate(
                            """() => Array.from(
                                 document.querySelectorAll(
                                   "input, textarea")).some(el => {
                               if (el.disabled || el.readOnly) return false;
                               const ty = (el.type || '').toLowerCase();
                               if (ty && ['text','search','tel','url',
                                           'password',''].indexOf(ty) < 0)
                                   return false;
                               const r = el.getBoundingClientRect();
                               return r.width > 0 && r.height > 0;
                           })"""))
                    except Exception:
                        return False

                # SaluteJazz — SPA: при заходе на /calls/create форма рендерится
                # с задержкой и иногда перерисовывается после закрытия оверлеев.
                # Раньше бот искал поля один раз ~4 с и падал с «Не найдено поле
                # названия встречи», хотя через секунду форма появлялась
                # (в логах: успешный заход в 15:20, ошибка в 15:32).
                form_deadline = time.time() + min(max(timeout // 2, 15), 40)
                while time.time() < form_deadline and not _form_ready():
                    time.sleep(0.5)
                    _dismiss_overlays(page)

                # Реальные селекторы страницы https://salutejazz.ru/calls/create
                #   input[name='conferenceName'] — название встречи
                #   input[name='userName']       — имя участника
                #   button[data-testid='createConf'] — создать и войти
                # 1) Название встречи
                name_selectors = [
                    "input[name='conferenceName']",
                    "input[name='title']", "input[placeholder*='азван' i]",
                    "input[placeholder*='тема' i]", "input[placeholder*='meet' i]",
                    "textarea", "input[type='text']",
                ]
                el, sel = self._find_input(page, name_selectors)
                # Последний шанс: страница могла перерисоваться в момент поиска —
                # подождать ещё цикл и попробовать снова (раньше здесь бот падал).
                if el is None and not _form_ready():
                    retry_deadline = time.time() + 10
                    while time.time() < retry_deadline and not _form_ready():
                        time.sleep(0.5)
                        _dismiss_overlays(page)
                    el, sel = self._find_input(page, name_selectors,
                                               timeout_ms=8000)
                if el is None:
                    try:
                        page.screenshot(path="/tmp/vksbot_fail.png")
                        log.error("Скриншот неудачной страницы: "
                                  "/tmp/vksbot_fail.png (docker compose cp "
                                  "vks-bot:/tmp/vksbot_fail.png .)")
                    except Exception:
                        pass
                    raise RuntimeError("Не найдено поле названия встречи")
                self._set_value(page, el, title)
                log.info("Введено название (%s), значение: %r",
                         sel, el.get_attribute("value"))

                # 2) Имя участника/организатора
                el2, sel2 = self._find_input(page, [
                    "input[name='userName']",
                    "input[name='name']", "input[placeholder*='имя' i]",
                    "input[placeholder*='как вас' i]",
                    "input[placeholder*='представ' i]",
                    "input[type='text']:not([name='conferenceName'])"
                    ":not([name='title'])",
                ])
                if el2 is not None and el2 != el:
                    self._set_value(page, el2, name)
                    log.info("Введено имя (%s)", sel2)
                else:
                    log.warning("Поле имени не найдено — жмём создание сразу")

                # 2.5) Дата встречи: если на форме есть datetime/date-поле —
                # ставим туда дату из запроса (иначе платформа создаёт комнату
                # «на сегодня», и встреча «уезжала» не на тот день).
                dt_status = _fill_datetime_fields(page, date)
                log.info("Дата встречи (%s): %r -> поля формы: %s",
                         sel if el is not None else "?", date, dt_status)

                # 3) Кнопка входа/создания. Основной способ — data-testid,
                # запасной — поиск по тексту через JS (кириллица ломает XPath
                # translate(), поэтому читаем textContent напрямую).
                labels = ("присоединиться", "войти", "создать",
                          "join", "start", "create")

                def _collect_buttons():
                    cands = page.query_selector_all(
                        "button[data-testid='createConf']")
                    if cands:
                        return cands
                    return page.query_selector_all("button, a")

                def _safe_text(h) -> str:
                    try:
                        return str(page.evaluate(
                            "el => el.textContent || ''", h))
                    except Exception:
                        return ""

                clicked = False
                for attempt in range(3):
                    for b in _collect_buttons():
                        txt = _safe_text(b).strip().lower()
                        by_testid = b.get_attribute("data-testid") == "createConf"
                        if not (by_testid or any(lb in txt for lb in labels)):
                            continue
                        try:
                            b.scroll_into_view_if_needed(timeout=3000)
                        except Exception:
                            pass
                        try:
                            b.click(timeout=5000)
                        except Exception:
                            try:
                                page.evaluate("el => el.click()", b)
                            except Exception:
                                continue
                        clicked = True
                        log.info("Нажата кнопка создания (повтор #%d): %r",
                                 attempt + 1, txt[:40])
                        break
                    if clicked:
                        break
                    time.sleep(0.5)  # SPA могла перерисовать DOM — перечитаем
                if not clicked:
                    raise RuntimeError(
                        "Не найдена кнопка создания/входа во встречу")

                # 4) Ждём ссылку вида https://salutejazz.ru/calls/<код>?psw=<пароль>.
                # Важно: страница /calls/create сама матчится на LINK_RE —
                # игнорируем URL с «create» и ждём реального кода комнаты.
                deadline = time.time() + timeout

                def _valid(candidate):
                    if not candidate:
                        return False
                    room_part = candidate.split("/calls/")[1].split("?")[0]
                    return room_part.lower() != "create"

                link = None
                while time.time() < deadline:
                    m = LINK_RE.search(page.url)
                    if m and _valid(m.group(0)):
                        link = m.group(0)
                        break
                    # иногда ссылка появляется в readonly-поле invite
                    values = page.eval_on_selector_all(
                        "input", "els => els.map(e => e.value || '')")
                    for v in values:
                        m = LINK_RE.search(v)
                        if m and _valid(m.group(0)) and m.group(0) != page.url:
                            link = m.group(0)
                            break
                    if link:
                        break
                    # copy-to-clipboard кнопки содержат полный URL в разметке
                    m = LINK_RE.search(page.content())
                    if m and _valid(m.group(0)):
                        link = m.group(0)
                        break
                    time.sleep(1)

                if not link:
                    raise RuntimeError(
                        "Ссылка на встречу так и не появилась за отведённое время")

                room = link.split("/calls/")[1].split("?")[0]
                psw_m = re.search(r"[?&]psw=([^&\s]+)", link)
                password = psw_m.group(1) if psw_m else ""

                # created_at — с явным смещением +03:00 (MSK). Контейнер бота
                # может жить в UTC, и «голое» время без таймзоны Laravel/фронт
                # парсили как локальное → дата встречи «уезжала» на 3 часа.
                tz_msk = timezone(timedelta(hours=3))
                result = {
                    "ok": True,
                    "link": link,
                    "room": room,
                    "password": password,
                    "title": title,
                    "date": date,
                    "name": name,
                    "created_at": datetime.now(tz_msk).strftime(
                        "%Y-%m-%d %H:%M:%S%z"),
                }
                log.info("Готово: %s", link)
                return result

            except Exception as e:  # noqa: BLE001
                log.exception("Ошибка создания ВКС (Playwright)")
                snippet = ""
                try:
                    if page is not None:
                        snippet = page.content()[:500]
                except Exception:
                    snippet = ""
                return {"ok": False, "error": str(e), "page_snippet": snippet}
            finally:
                for closer in (lambda: browser.close() if browser else None,
                               lambda: pw.stop() if pw else None):
                    try:
                        closer()
                    except Exception:
                        pass


def fallback_local_link() -> str:
    """Локальная генерация ссылки в эталонном формате (если бот недоступен)."""
    rnd = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    psw = "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    return f"https://salutejazz.ru/calls/{rnd}?psw={psw}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(
        description="Создать встречу на salutejazz.ru через Playwright")
    ap.add_argument("--title", default="Тестовая встреча")
    ap.add_argument("--name", default="Иван Петров")
    ap.add_argument("--headful", action="store_true",
                    help="показать браузер (для отладки)")
    args = ap.parse_args()

    bot = VkxBotPlaywright(headless=not args.headful)
    res = bot.create_call(args.title, args.name)
    print(json.dumps(res, ensure_ascii=False, indent=2))
