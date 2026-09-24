FROM node:20-alpine as builder

WORKDIR /app

# Настройка npm для стабильной работы с сетью
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 60000 && \
    npm config set fetch-retry-maxtimeout 300000 && \
    npm config set fetch-timeout 300000

# Копирование package.json
COPY package*.json ./

# Установка зависимостей
RUN npm install --legacy-peer-deps --maxsockets=1

# Копирование исходного кода
COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY tsconfig.json ./

# Сборка приложения (результат — в /app/dist)
RUN npm run build

# Финальный этап-экспортёр. Собранные файлы лежат в /export внутри образа.
# При старте контейнера они копируются в /mnt/dist — точку монтирования
# volume frontend_build (см. docker-compose.yml), тем самым наполняя его.
FROM alpine:3.20

COPY --from=builder /app/dist/ /export/

CMD ["sh", "-c", "cp -a /export/. /mnt/dist/ && echo frontend_build populated"]
