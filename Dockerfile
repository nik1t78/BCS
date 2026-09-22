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

# Сборка приложения
RUN npm run build

# Финальный образ с nginx
FROM nginx:alpine

# Копирование собранного приложения
COPY --from=builder /app/dist /var/www/frontend

# Копирование конфигурации nginx для SPA
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
