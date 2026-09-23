FROM php:8.4-fpm

# Установка системных зависимостей
# (libonig-dev уже содержит oniguruma — отдельный пакет "oniguruma5dev" не нужен)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    libjpeg-dev \
    libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Установка Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Установка рабочего каталога
WORKDIR /var/www/html

# Зависимости (vendor/) и код проекта монтируются через volume ./backend:/var/www/html,
# поэтому здесь НЕ выполняем composer install — он требует доступа к packagist.org,
# который недоступен из вашей сети. Установите зависимости локально командой:
#   composer install --no-dev --optimize-autoloader --ignore-platform-reqs

# Создание нужных директорий Laravel (на случай пустых volume)
RUN mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache

# Установка прав доступа
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Открытие порта
EXPOSE 9000

# Запуск PHP-FPM
CMD ["php-fpm"]
