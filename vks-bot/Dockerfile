FROM python:3.12-slim

# Chromium для браузера (Playwright использует системный бинарник через
# executable_path — отдельная `playwright install` не нужна).
# chromium-driver оставлен для запасного Selenium-движка (VKSBOT_ENGINE=selenium).
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /bot
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py bot_pw.py server.py ./

ENV BOT_HEADLESS=1
ENV BOT_PORT=8090
ENV VKSBOT_ENGINE=playwright
# Таймзона контейнера — Москва: дата «сегодня» не должна расходиться с
# фронтом (вечерний запрос после 21:00 MSK при UTC давал «вчера»).
# Резерв в коде: server.py сам считает «сегодня» по +03:00.
ENV TZ=Europe/Moscow
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && ln -sf /usr/share/zoneinfo/Europe/Moscow /etc/localtime \
    && echo Europe/Moscow > /etc/timezone && rm -rf /var/lib/apt/lists/*
EXPOSE 8090

CMD ["python", "server.py"]
