# Running the App

This application is containerized using [Laravel Sail](https://laravel.com/docs/sail). Laravel Sail provides a Docker-based development environment that includes PHP, MySQL, Redis, and other essential services required to run the application without needing to install them directly on your host machine.

## Prerequisites

Before you start, ensure you have the following installed on your machine:
- [Docker](https://www.docker.com/products/docker-desktop/) (and Docker Compose)

## Setup and Running

Follow these steps to get the application running on your local machine:

### 1. Copy the Environment File
If you haven't already, copy the example environment file and configure it:
```bash
cp .env.example .env
```
*(Note: The default `.env.example` settings are already configured to work seamlessly with Sail.)*

### 2. Start the Docker Containers
To start all the necessary Docker containers in the background, run:
```bash
./vendor/bin/sail up -d
```
*(Tip: You can create a bash alias for `sail` so you don't have to type the full path: `alias sail='sh $([ -f sail ] && echo sail || echo vendor/bin/sail)'`)*

The local app expects Redis to be available for sessions and queues:
```env
SESSION_DRIVER=redis
SESSION_STORE=redis
QUEUE_CONNECTION=redis
REDIS_HOST=redis
CACHE_STORE=file
```

After changing these values, clear cached config:
```bash
./vendor/bin/sail artisan config:clear
```

To process background jobs locally, run a queue worker in a separate terminal:
```bash
./vendor/bin/sail artisan queue:work redis --queue=default,network-enforcement --sleep=1 --tries=3 --timeout=120
```

Manual customer isolation/reconnection does not need this worker because it runs against MikroTik immediately from the admin action.

### 3. Install PHP Dependencies
If you haven't installed the composer dependencies yet, run:
```bash
./vendor/bin/sail composer install
```

### 4. Run Migrations
Initialize the database with the required tables:
```bash
./vendor/bin/sail artisan migrate
```
*(You may want to add `--seed` if there are database seeders available: `./vendor/bin/sail artisan migrate --seed`)*

### 5. Install Node Dependencies
Install the required frontend packages:
```bash
./vendor/bin/sail npm install
```

### 6. Start the Vite Development Server
To compile assets and start the frontend development server, run:
```bash
./vendor/bin/sail npm run dev
```

## Accessing the Application

Once the containers and Vite server are running, you can access the application in your browser at:

- **Main Application**: [http://localhost](http://localhost)

## Stopping the Application

When you're done working, you can safely stop and remove the containers by running:
```bash
./vendor/bin/sail down
```

## Running Tests

Use the disposable `mysql-test` service for MySQL-backed PHPUnit runs. It uses an in-memory Docker filesystem, so each start is clean and it does not reuse the development database volume.

```bash
WWWGROUP=$(id -g) WWWUSER=$(id -u) docker compose up -d mysql-test laravel.test

WWWGROUP=$(id -g) WWWUSER=$(id -u) docker compose exec -T laravel.test env \
  DB_CONNECTION=mysql \
  DB_HOST=mysql-test \
  DB_PORT=3306 \
  DB_DATABASE=testing \
  DB_USERNAME=sail \
  DB_PASSWORD=password \
  php artisan test
```

For the restored isolation feature only:

```bash
WWWGROUP=$(id -g) WWWUSER=$(id -u) docker compose exec -T laravel.test env \
  DB_CONNECTION=mysql \
  DB_HOST=mysql-test \
  DB_PORT=3306 \
  DB_DATABASE=testing \
  DB_USERNAME=sail \
  DB_PASSWORD=password \
  php artisan test tests/Feature/IsolationFeatureTest.php
```

## MikroTik-First Cleanup Flow

MikroTik is treated as the active-network source of truth. Run a full router sync before cleanup so eBilling has fresh `synced`/`missing` customer states and router-only PPPoE secrets are staged for review.

```bash
./vendor/bin/sail artisan routers:scan
```

Customers with at least three unpaid invoice periods can be reviewed with a dry run:

```bash
./vendor/bin/sail artisan customers:cleanup-delinquent
```

Apply cleanup only after reviewing the dry-run table:

```bash
./vendor/bin/sail artisan customers:cleanup-delinquent --apply
```

Cleanup soft-deletes eligible customers and preserves invoices, transactions, and activity logs.

## Isolation and Queue Behavior

Manual customer isolation/reconnection from the customer page is real-time: the web request talks to MikroTik immediately and returns success or failure to the admin.

Background automation is queued through Redis:
- overdue invoice isolation
- payment-triggered reconnection
- router full sync

Production workers should run the default queue and dedicated MikroTik queues. The included `supervisord.conf` starts:
- `queue-default`
- `queue-network-enforcement`
- `queue-router-sync`

After changing queue/session Redis config in production, restart the application workers so they pick up the cached config.
