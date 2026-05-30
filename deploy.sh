#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/skynet-ebilling}"
SERVICE_NAME="${SERVICE_NAME:-laravel.test}"
OWNER_UID="${OWNER_UID:-1000}"
OWNER_GID="${OWNER_GID:-1000}"

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

run() {
    log "$1"
    shift
    "$@"
}

cd "$APP_DIR"

run "Pull latest code from origin/main" git pull origin main

run "Ensure runtime directories exist" mkdir -p storage/logs bootstrap/cache public/build

run "Fix project ownership" chown -R "${OWNER_UID}:${OWNER_GID}" "$APP_DIR"
run "Fix directory permissions" find "$APP_DIR" -type d -exec chmod 755 {} \;
run "Fix file permissions" find "$APP_DIR" -type f -exec chmod 644 {} \;
run "Make Laravel runtime paths writable" chmod -R ug+rwX storage bootstrap/cache public/build

run "Rebuild and start containers" docker compose up -d --build
run "Install PHP dependencies" docker compose exec "$SERVICE_NAME" composer install
run "Run database migrations" docker compose exec "$SERVICE_NAME" php artisan migrate
run "Build frontend assets" docker compose exec "$SERVICE_NAME" npm run build
run "Clear Laravel caches" docker compose exec "$SERVICE_NAME" php artisan optimize:clear
run "Fix runtime permissions inside container" docker compose exec "$SERVICE_NAME" sh -lc "chown -R sail:sail /var/www/html/storage /var/www/html/bootstrap/cache || true && chmod -R ug+rwX /var/www/html/storage /var/www/html/bootstrap/cache || true"
run "Restart Laravel container" docker compose restart "$SERVICE_NAME"
run "Show recent container logs" docker compose logs --tail=100 "$SERVICE_NAME"
run "Probe local HTTP endpoint" curl -I http://127.0.0.1

log "Deployment flow completed. Refresh the browser now."
