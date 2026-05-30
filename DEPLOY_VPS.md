# Skynet E-Billing VPS Deploy

Target default:

- Web app: `http://129.212.229.214:8080`
- RADIUS auth: UDP `1812`
- RADIUS accounting: UDP `1813`
- Admin login: `admin@skynet.id` / `skynet123`

## Deploy

```bash
cd /opt/skynet-ebilling
cp .env.production.example .env
docker compose -f compose.production.yaml up -d --build
```

Generate `APP_KEY` once if `.env` still has an empty key:

```bash
docker compose -f compose.production.yaml exec app php artisan key:generate --force
```

## MikroTik RADIUS Setup

Replace `RADIUS_SECRET_FROM_ROUTER_PAGE` with the secret shown/saved in the router page.

```routeros
/radius add service=ppp address=129.212.229.214 secret=RADIUS_SECRET_FROM_ROUTER_PAGE authentication-port=1812 accounting-port=1813 timeout=300ms
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
```

Then add the router in Skynet E-Billing, enable RADIUS, save the same secret, and click sync RADIUS.

## Firewall

Open these ports on the VPS/firewall provider:

```bash
ufw allow 8080/tcp
ufw allow 1812/udp
ufw allow 1813/udp
```

## Useful Checks

```bash
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail=100 app
docker compose -f compose.production.yaml logs --tail=100 freeradius
docker compose -f compose.production.yaml exec app php artisan migrate:status
```
