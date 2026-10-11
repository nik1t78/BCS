FROM python:3.12-slim

# Хром + хромдрайвер для Selenium-бота
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /bot
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py server.py ./

ENV BOT_HEADLESS=1
ENV BOT_PORT=8090
EXPOSE 8090

CMD ["python", "server.py"]
