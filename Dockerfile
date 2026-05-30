FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY resources ./resources
COPY public ./public
COPY tsconfig.json vite.config.js components.json ./
RUN npm run build

FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts --ignore-platform-req=ext-sockets
COPY . .
RUN composer dump-autoload --optimize

FROM php:8.4-apache

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        default-mysql-client \
        git \
        libicu-dev \
        libonig-dev \
        libpng-dev \
        libzip-dev \
        openssh-client \
        python3-pexpect \
        snmp \
        unzip \
        zip \
    && docker-php-ext-install bcmath exif gd intl pcntl pdo_mysql sockets zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && a2enmod rewrite headers \
    && sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && echo 'Header always set X-Frame-Options "SAMEORIGIN"' >> /etc/apache2/conf-available/security-headers.conf \
    && echo 'Header always set X-Content-Type-Options "nosniff"' >> /etc/apache2/conf-available/security-headers.conf \
    && echo 'Header always set X-XSS-Protection "1; mode=block"' >> /etc/apache2/conf-available/security-headers.conf \
    && echo 'Header always set Referrer-Policy "strict-origin-when-cross-origin"' >> /etc/apache2/conf-available/security-headers.conf \
    && echo 'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(self)"' >> /etc/apache2/conf-available/security-headers.conf \
    && a2enconf security-headers \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY --from=vendor /app ./
COPY --from=assets /app/public/build ./public/build
COPY docker/app-entrypoint.sh /usr/local/bin/skynet-entrypoint

RUN chmod +x /usr/local/bin/skynet-entrypoint \
    && mkdir -p storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache public

ENTRYPOINT ["skynet-entrypoint"]
CMD ["apache2-foreground"]
