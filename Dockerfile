FROM node:20-alpine AS builder

WORKDIR /app

# Кеш-слой: зависимости ставятся заново только при изменении package.json/lock
COPY package*.json ./
RUN npm ci --maxsockets=5 || npm install --legacy-peer-deps --maxsockets=1

COPY src ./src
COPY public ./public
COPY index.html vite.config.js tsconfig.json ./

# NODE_OPTIONS — лимит heap, чтобы сборка не съедала всю оперативку
ENV NODE_OPTIONS=--max-old-space-size=768
RUN npm run build

# Финальный крошечный образ-экспортёр (alpine, без node)
FROM alpine:3.20
COPY --from=builder /app/dist/ /export/
CMD ["sh", "-c", "cp -a /export/. /mnt/dist/ && echo frontend_build populated"]
