FROM node:20-alpine as builder

WORKDIR /app

# Копирование package.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Финальный образ с nginx
FROM nginx:alpine

# Копирование собранного приложения
COPY --from=builder /app/dist /var/www/frontend

# Копирование конфигурации nginx для SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
