FROM node:20-alpine@sha256:afdf98210b07b586eb71fa22ba2e432e058e4cd1304d31ed60888755b8c865fb AS builder

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
FROM alpine:3.20@sha256:c64c687cbea9300178b30c95835354e34c4e4febc4badfe27102879de0483b5e
COPY --from=builder /app/dist/ /export/
CMD ["sh", "-c", "cp -a /export/. /mnt/dist/ && echo frontend_build populated"]
