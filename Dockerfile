FROM node:20-alpine AS builder

WORKDIR /app

# Кеш-слой: зависимости ставятся заново только при изменении package.json/lock
COPY package*.json ./
RUN npm ci --maxsockets=5 || npm install --legacy-peer-deps --maxsockets=1

COPY src ./src
COPY public ./public
# .env.production подхватывается Vite при `npm run build` (режим production) —
# без него VITE_*-переменные из файла окружения в docker-сборку не попадают.
# Файл отсутствует в контексте — COPY молча пропускается (это допустимо).
COPY .env.production* ./
COPY index.html vite.config.js tsconfig.json package.json ./

# NODE_OPTIONS — лимит heap, чтобы сборка не съедала всю оперативку
ENV NODE_OPTIONS=--max-old-space-size=768
# "1" — включить автосоздание ВКС через Selenium-бота (см. src/utils/vksBot.ts).
# По умолчанию "0": ссылка генерируется локально, контейнер vks-bot не нужен.
ARG VITE_VKS_AUTOBOT=0
ENV VITE_VKS_AUTOBOT=$VITE_VKS_AUTOBOT
ARG VITE_VKS_BOT_TOKEN=
ENV VITE_VKS_BOT_TOKEN=$VITE_VKS_BOT_TOKEN
RUN npm run build

# Финальный крошечный образ-экспортёр (alpine, без node)
FROM alpine:3.20
COPY --from=builder /app/dist/ /export/
CMD ["sh", "-c", "cp -a /export/. /mnt/dist/ && echo frontend_build populated"]
