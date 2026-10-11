# -*- coding: utf-8 -*-
"""
VKS-бот (Selenium): автоматически заходит на https://salutejazz.ru/calls/create,
вводит название встречи и имя организатора, получает готовую ссылку на ВКС.

Используется как HTTP-микросервис (см. server.py): POST /create {title, name}
  -> {"link": "https://salutejazz.ru/calls/xxxxx?psw=YYYY", "room": "xxxxx", ...}

Запуск напрямую (отладка одного создания):
    python bot.py --title "Планёрка" --name "Иван Петров" [--headless]
"""
import argparse
import json
import logging
import random
import re
import string
import threading
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CREATE_URL = "https://salutejazz.ru/calls/create"
LINK_RE = re.compile(r"https://salutejazz\.ru/calls/[A-Za-z0-9_-]+(?:\?[^\s\"'<]*)?")

log = logging.getLogger("vks-bot")


def _chrome_options(headless: bool = True) -> Options:
    opts = Options()
    if headless:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--lang=ru-RU")
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    )
    # не даём сайту требовать микрофон/камеру при предпросмотре
    opts.add_experimental_option(
        "prefs",
        {
            "permissions.default.microphone": 2,
            "permissions.default.camera": 2,
            "profile.default_content_setting_values.notifications": 2,
        },
    )
    return opts


class VkxBot:
    """Одна «сессия» = один заход на salutejazz.ru. Потокобезопасно через lock."""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self._lock = threading.Lock()

    def _make_driver(self) -> webdriver.Chrome:
        driver = webdriver.Chrome(options=_chrome_options(self.headless))
        driver.set_page_load_timeout(45)
        return driver

    @staticmethod
    def _find_input(driver, tries_css):
        """Найти первое существующее текстовое поле из списка селекторов."""
        for css in tries_css:
            try:
                el = WebDriverWait(driver, 4).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, css))
                )
                if el.is_displayed():
                    return el, css
            except Exception:
                continue
        return None, None

    @staticmethod
    def _type(el, text: str):
        el.click()
        el.send_keys("\ue00c" * 40)  # Ctrl+A + Delete — очистить поле
        for ch in text:
            el.send_keys(ch)
            time.sleep(random.uniform(0.02, 0.06))  # печатаем «по-человечески»

    def create_call(self, title: str, name: str, timeout: int = 60) -> dict:
        """Создать встречу на SaluteJazz и вернуть ссылку.

        Возвращает: {"ok": True, "link": ..., "room": ..., "password": ...}
        либо      {"ok": False, "error": "..."}
        """
        title = (title or "Встреча").strip()[:120]
        name = (name or "Организатор").strip()[:80]

        with self._lock:
            driver = None
            try:
                driver = self._make_driver()
                driver.get(CREATE_URL)

                # Ждём, пока SPA отрендерит форму (input или кнопку)
                WebDriverWait(driver, timeout).until(
                    lambda d: d.find_elements(By.CSS_SELECTOR, "input, textarea, button")
                )
                time.sleep(1.5)  # догреваем React-форму

                # 1) Название встречи
                el, sel = self._find_input(driver, [
                    "input[name='title']", "input[placeholder*='азван' i]",
                    "input[placeholder*='тема' i]", "input[placeholder*='meet' i]",
                    "textarea", "input[type='text']",
                ])
                if el is None:
                    raise RuntimeError("Не найдено поле названия встречи")
                self._type(el, title)
                log.info("Введено название (%s), значение: %r", sel, el.get_attribute("value"))

                # 2) Имя участника/организатора
                el2, sel2 = self._find_input(driver, [
                    "input[name='name']", "input[placeholder*='имя' i]",
                    "input[placeholder*='как вас' i]", "input[placeholder*='представ' i]",
                    "input[type='text']:not([name='title'])",
                ])
                if el2 is not None and el2 is not el:
                    self._type(el2, name)
                    log.info("Введено имя (%s)", sel2)
                else:
                    log.warning("Поле имени не найдено — жмём создание сразу")

                # 3) Кнопка входа/создания
                clicked = False
                for label in ("Присоединиться", "Войти", "Создать", "Join", "Start"):
                    btns = driver.find_elements(
                        By.XPATH,
                        f"//button[contains(translate(text(),'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ',"
                        f"'абвгдежзиклмнопрстухцчшщэюя',''), '{label.lower()}')]",
                    )
                    if btns:
                        driver.execute_script("arguments[0].scrollIntoView(true);", btns[0])
                        btns[0].click()
                        clicked = True
                        log.info("Нажата кнопка: %s", label)
                        break
                if not clicked:
                    raise RuntimeError("Не найдена кнопка создания/входа во встречу")

                # 4) Ждём ссылку вида https://salutejazz.ru/calls/<код>?psw=<пароль>
                deadline = time.time() + timeout
                link = None
                while time.time() < deadline:
                    url = driver.current_url
                    m = LINK_RE.search(url)
                    if m:
                        link = m.group(0)
                        break
                    # иногда ссылка появляется в поле invite / input readonly
                    for inp in driver.find_elements(By.CSS_SELECTOR, "input"):
                        v = (inp.get_attribute("value") or "")
                        m = LINK_RE.search(v)
                        if m:
                            link = m.group(0)
                            break
                    if link:
                        break
                    # copy-to-clipboard кнопки часто содержат полный URL в data-атрибутах
                    body_html = driver.page_source
                    m = LINK_RE.search(body_html)
                    if m and "create" not in m.group(0):
                        link = m.group(0)
                        break
                    time.sleep(1)

                if not link:
                    raise RuntimeError("Ссылка на встречу так и не появилась за отведённое время")

                room = link.split("/calls/")[1].split("?")[0]
                psw_m = re.search(r"[?&]psw=([^&\s]+)", link)
                password = psw_m.group(1) if psw_m else ""

                result = {
                    "ok": True,
                    "link": link,
                    "room": room,
                    "password": password,
                    "title": title,
                    "name": name,
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                log.info("Готово: %s", link)
                return result

            except Exception as e:  # noqa: BLE001
                log.exception("Ошибка создания ВКС")
                try:
                    page = driver.page_source[:2000] if driver else ""
                except Exception:
                    page = ""
                return {"ok": False, "error": str(e), "page_snippet": page[:500]}
            finally:
                if driver:
                    try:
                        driver.quit()
                    except Exception:
                        pass


def fallback_local_link() -> str:
    """Локальная генерация ссылки в эталонном формате (если бот недоступен)."""
    rnd = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    psw = "".join(random.choices(string.ascii_uppercase + string.digits, k=16))
    return f"https://salutejazz.ru/calls/{rnd}?psw={psw}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Создать встречу на salutejazz.ru через Selenium")
    ap.add_argument("--title", default="Тестовая встреча")
    ap.add_argument("--name", default="Иван Петров")
    ap.add_argument("--headful", action="store_true", help="показать браузер (для отладки)")
    args = ap.parse_args()

    bot = VkxBot(headless=not args.headful)
    res = bot.create_call(args.title, args.name)
    print(json.dumps(res, ensure_ascii=False, indent=2))
