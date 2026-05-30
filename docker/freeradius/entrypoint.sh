#!/usr/bin/env bash
set -euo pipefail

config=/etc/freeradius/3.0/mods-available/sql

escape_sed() {
    printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

sed -i \
    -e "s/__DB_HOST__/$(escape_sed "${DB_HOST:-mysql}")/g" \
    -e "s/__DB_PORT__/$(escape_sed "${DB_PORT:-3306}")/g" \
    -e "s/__DB_USERNAME__/$(escape_sed "${DB_USERNAME:-skynet}")/g" \
    -e "s/__DB_PASSWORD__/$(escape_sed "${DB_PASSWORD:-skynet_secret}")/g" \
    -e "s/__DB_DATABASE__/$(escape_sed "${DB_DATABASE:-skynet_ebilling}")/g" \
    "$config"

exec "$@"
