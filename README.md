# Dollar Cost Average Bot

A cryptocurrency dollar cost average bot that buys BTC using a strategy to buy more or less based on market conditions.

The bot also keeps a record of what the value would be if it had just obught the exact same amount every time as well, so a comparison can be visualized.

## Table of Contents

- [Features](#features)
- [Trading Logic](#trading-logic)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)

## Features

- Automated DCA purchases on customizable schedules
- Priority-based multiplier strategy (see [docs/design-docs/multiplier-strategy.md](./docs/design-docs/multiplier-strategy.md))
- Hyperliquid spot buys with retry logic and a double-spend guard
- Portfolio tracking with ROI calculations comparing programmatic vs fixed DCA
- Discord notifications with trade summaries
- Settings UI for configuration management
- Encrypted Hyperliquid API key with 180-day expiry warnings
- Configuration staleness warnings
- Swagger API documentation at `/docs`
- Wallet balance monitoring

### Roadmap

- Specify time of day, interval, hourly buys, etc.
- DCA using any token (not just USDC)
- Show bot performance over time

## Trading Logic

The bot uses a multiplier-based strategy that adjusts purchase amounts based on market conditions. See [docs/design-docs/multiplier-strategy.md](./docs/design-docs/multiplier-strategy.md) for detailed documentation on:

- How multipliers work based on market indicators
- Indicator rankings and importance (priority-based evaluation)
- Configuration and data sources

## Architecture

```text
lib/                          # Core business logic modules
├── strategy.ts               # Multiplier calculation + DCA orchestration
├── hyperliquid-bot.ts        # Hyperliquid spot order execution
├── hyperliquid.ts            # Hyperliquid price feed + SMA
├── notifications.ts          # Notification fan-out
├── discord.ts                # Discord webhook delivery
├── app-config.ts             # AppConfiguration read/write
├── encryption.ts             # AES-256-GCM for the API key
├── key-expiry.ts             # API key expiry warnings
├── configuration-staleness.ts  # Config update warnings
├── logger.ts                 # Structured logging + redaction
├── metrics.ts                # Prometheus metrics registry
├── db.ts                     # Prisma client
└── utils.ts                  # Shared utilities

app/
├── api/                      # API routes
│   ├── cron/                 # Bot execution endpoint (Bearer auth)
│   ├── dashboard/            # Portfolio stats
│   ├── multiplier-configuration/  # Multiplier upsert
│   ├── app-configuration/    # App config read/update
│   ├── configuration-staleness/   # Staleness check
│   ├── wallet-balance/       # Wallet balance
│   ├── trigger-bot/          # Manual run trigger
│   ├── test-discord/         # Discord test message
│   ├── deploy-notify/        # Post-deploy notification
│   ├── health/               # Readiness probe
│   └── metrics/              # Prometheus scrape endpoint
├── settings/                 # Settings UI pages
├── docs/                     # Swagger API documentation
└── page.tsx                  # Dashboard

prisma/
└── schema.prisma             # Database schema (Transaction, MultiplierConfiguration, AppConfiguration)
```

### Design Principles

- **DB-backed configuration**: Settings stored in PostgreSQL, managed via the UI (no env fallback)
- **Priority-based strategy**: First matching multiplier wins, no stacking
- **Dual tracking**: Records both programmatic and fixed DCA for comparison

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- PostgreSQL 14+
- Hyperliquid API wallet (configured via Settings UI)

## Installation

```bash
# Clone repository
git clone <repo-url>
cd dca-bot

# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Push schema to database
bunx prisma db push
```

## Configuration

Configuration is **DB-backed**: all `AppConfiguration` settings are managed through the Settings UI and read directly from the database — environment variables are **not** used as fallbacks for them. Only bootstrap values (`DATABASE_URL`, `DB_ENCRYPTION_KEY`), the cron schedule, and runtime flags are environment variables.

### ENV-Only Variables

These must be set via environment variables and cannot be configured through the UI:

| Variable                          | Required | Default          | Description                              |
|-----------------------------------|----------|------------------|------------------------------------------|
| `DATABASE_URL`                    | Yes      | -                | PostgreSQL connection string             |
| `DB_ENCRYPTION_KEY`               | Yes      | -                | 32-byte hex key for encrypting the Hyperliquid API private key at rest. Generate with `openssl rand -hex 32` |
| `CRON_SECRET`                     | Yes (cron) | -              | Bearer secret the cron container sends; must match `AppConfiguration.cronSecret` |
| `CRON_EXPRESSION`                 | No       | `0 0,12 * * *`   | Cron schedule (default: midnight & noon) |
| `API_URL`                         | No       | `http://localhost:3001` | Base URL the cron script calls    |
| `LOG_LEVEL`                       | No       | `INFO`           | `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT` |
| `ENABLE_LOGS`                     | No       | `true`           | Set to `false` to disable all logging    |
| `TEST_MODE`                       | No       | `false`          | Buffers logs in memory; cron container runs the bot immediately on startup |

### DB-Managed Settings (Settings UI only)

These are stored in `AppConfiguration` and configured through `/settings` — they are **not** environment variables:

| Setting | Settings page | Default | Description |
|---------|---------------|---------|-------------|
| Base Purchase Amount | DCA | `5` | Base USD amount per purchase |
| Hyperliquid Symbol | DCA | `BTC` | Symbol used for price data |
| Low Balance Threshold | Trading | `100` | USDC balance below this triggers a Discord warning |
| Cron Secret | Schedule | — | Bearer secret for `/api/cron` (must match the cron container's `CRON_SECRET`) |
| Discord Webhook URL | Notifications | — | Discord channel webhook for trade/failure alerts |
| Discord Enabled | Notifications | `true` | Master toggle for notifications |
| Staleness thresholds | Staleness Alerts | `1` / `2` weeks | Warning / danger thresholds for stale multiplier values |

### Hyperliquid API Credentials

The Hyperliquid API wallet private key and address are configured through the Settings UI at `/settings/hyperliquid`. They are stored encrypted in the database (AES-256-GCM) and never returned to the frontend. Keys expire after 180 days; a 7-day warning is sent via the configured notification channel.

### Quick Start

```bash
cp .env.example .env
# Edit .env and set required values: DATABASE_URL, DB_ENCRYPTION_KEY
# Then visit /settings/hyperliquid to configure your API wallet credentials
```

### Getting a Discord Webhook

In your Discord server, open **Channel Settings → Integrations → Webhooks → New Webhook**, copy the webhook URL, and paste it into `/settings/notifications`. See the [Discord webhook guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

## Development

### Docker Compose Debug Stack

```bash
# Create your local environment file
cp .env.example .env

# Set a real local encryption key before saving Hyperliquid credentials
openssl rand -hex 32
```

Paste the generated value into `DB_ENCRYPTION_KEY` in `.env`.

```bash
# Start PostgreSQL and the Next.js dev server with hot reload
docker compose up app
```

The app will be available at `http://localhost:3001`. The compose command automatically:

- starts PostgreSQL with persistent local storage
- installs Bun dependencies into a Docker volume
- generates the Prisma client
- pushes the Prisma schema into the local database
- starts `next dev` on port `3001`

Useful debugging commands:

```bash
# View logs
docker compose logs -f app

# Open a shell in the app container
docker compose exec app sh

# Open Prisma Studio
docker compose exec app bunx prisma studio -- --hostname 0.0.0.0
# Then open http://localhost:5555

# Stop containers without deleting database data
docker compose down

# Stop containers and delete local database/dependency volumes
docker compose down -v
```

To also run the scheduler locally:

```bash
docker compose --profile cron up app cron
```

By default, cron calls the app at `http://app:3001` using `CRON_SECRET=local-debug-cron-secret` unless you override it in `.env`.

### Host App with Docker Postgres

If you prefer debugging the Next.js process directly on your host:

```bash
# Start only the local database
docker compose up -d db

# Install dependencies and prepare Prisma
bun install
bunx prisma generate
bunx prisma db push

# Start the dev server
bun run dev --hostname 0.0.0.0 --port 3001
```

### Database Commands

```bash
# Generate Prisma client after schema changes
bunx prisma generate

# Push schema changes to database
bunx prisma db push

# Open Prisma Studio (database GUI)
bunx prisma studio
```

### Project Scripts

| Script                 | Description                          |
|------------------------|--------------------------------------|
| `bun run dev`          | Start the Next.js dev server         |
| `bun run build`        | Production build                     |
| `bun run start`        | Start the production server (port 3001) |
| `bun run cron`         | Start the node-cron scheduler        |
| `bun run lint`         | Run ESLint                           |
| `bun run test`         | Run all tests (`run-tests.sh`)       |
| `bun run test:watch`   | Run tests in watch mode              |
| `bun run test:coverage`| Run tests with coverage              |

## Testing

The project uses Bun's built-in test runner. Tests live alongside the code they cover with a `.test.ts` suffix (e.g. `lib/strategy.test.ts`, `app/api/cron/route.test.ts`).

```bash
# Run all tests (each file in its own process — see below)
bun run test

# Run tests in watch mode
bun run test:watch

# Run a specific test file
bun test lib/strategy.test.ts
```

### Test Structure

Tests are colocated with source. `bun run test` invokes `run-tests.sh`, which runs **each test file in its own `bun test` process** — required because tests use `mock.module()` to replace dependencies, and that mock state leaks within a single process.

### Writing Tests

Tests isolate the unit under test with `mock.module()`, replacing an entire module before it is imported:

```typescript
import { mock, afterEach } from "bun:test";

mock.module("@/lib/hyperliquid", () => ({
  getCurrentPrice: async () => 95_000,
}));

afterEach(() => mock.restore());
```

## Deployment

### Quick Start with Docker

The easiest way to get started is with Docker Compose, which includes PostgreSQL:

```bash
# Clone the repository
git clone <repo-url>
cd smart-dca-bot

# Create your .env file with minimal required values
cp .env.example .env
# Edit .env and set DB_ENCRYPTION_KEY before saving Hyperliquid credentials

# Start everything (database + app)
docker compose up -d app
```

This will:

- Start a PostgreSQL database with persistent storage
- Run the Next.js dev server on port 3001
- Automatically connect the bot to the database

**Optional: Include the cron scheduler**

```bash
# Start with cron service enabled
docker compose --profile cron up -d app cron
```

### Configuration via UI

Once the app is running, visit `http://localhost:3001/settings` to configure settings through the web interface. Settings saved in the Settings page are stored in the database and read directly by the bot.

**Note:** `DB_ENCRYPTION_KEY`, `CRON_EXPRESSION`, and runtime flags (`TEST_MODE`) must be set via environment variables and cannot be configured through the UI. Hyperliquid API credentials are configured at `/settings/hyperliquid`.

### Manual Deployment

If you prefer to use your own PostgreSQL instance:

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Push schema to database
bunx prisma db push

# Start bot
bun run start
```

## Disclaimer

This software places real orders with real funds on Hyperliquid. It is provided as-is, with no warranty of any kind — you are solely responsible for any financial loss incurred by running it. Nothing here is financial advice. Review the strategy, test with small amounts first, and never fund it with more than you can afford to lose.

## License

[MIT](LICENSE) © Wesley Coetzee
