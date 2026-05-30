#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

mkdir -p storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache public || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan config:clear

    if [ -z "${APP_KEY:-}" ]; then
        php artisan key:generate --force
    fi

    php artisan migrate --force

    if [ "${RUN_SEEDERS:-false}" = "true" ]; then
        php artisan db:seed --class=DatabaseSeeder --force
    fi

    php artisan storage:link || true
    php artisan optimize:clear
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

exec "$@"
