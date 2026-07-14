# Plans

Current state of the project and what comes next.

## What Is Built

The core bot is complete and running in production.

**Trading engine**
- Multiplier strategy with four on-chain indicators (`lib/strategy.ts`)
- Hyperliquid spot buys (IOC limit orders) with retry logic and a double-spend guard (`lib/hyperliquid-bot.ts`)
- Encrypted Hyperliquid API key with 180-day expiry warnings (`lib/encryption.ts`, `lib/key-expiry.ts`)
- Dual DCA recording (programmatic + fixed benchmark) on every trade

**Scheduling**
- `CRON_EXPRESSION` env var controls schedule
- `/api/cron` endpoint with `CRON_SECRET` header auth
- `bun run cron` runs the node-cron scheduler locally

**Dashboard**
- ROI comparison chart: programmatic vs fixed DCA equity curves
- Period selector: 1 month, 1 year, all time
- Live BTC price via Hyperliquid WebSocket (`useHyperliquidPrices`)
- Transaction history table showing programmatic trades, price, and reason

**Settings UI**
- `AppConfiguration` editing across Trading, DCA, Notifications, Schedule, Hyperliquid, and Staleness pages
- Multiplier configuration UI (`/settings/multiplier-settings`)
- Discord test integration (`/api/test-discord`)
- Configuration staleness warnings when reference values are not updated on schedule

**Observability**
- Structured logging via `lib/logger.ts`
- Prometheus metrics exposed (execution count, duration, purchase amounts, wallet balances, multiplier triggered)
- Staleness alerts in Discord notifications

**API**
- Swagger docs at `/docs`
- All routes documented in `app/api/`

## Current Priorities

### 1. Fix tech debt TD-005 — indicator evaluation order

The code evaluates LTH Buying before Average Realized Price, which is the reverse of the documented intent. Both carry 5x so there is no financial impact today, but the code diverges from spec. Fix before adding any new indicators.

See [tech-debt-tracker.md](./exec-plans/tech-debt-tracker.md#td-005-lth_buying-evaluated-before-average_realized_price).

### 2. Fix staleness route error handling

HTTP 200 on error means silent failures. Easy fix.

See [tech-debt-tracker.md](./exec-plans/tech-debt-tracker.md#td-003-silent-error-swallow-in-staleness-route).

## Deferred

### Dashboard chart split

Split the single chart into two separate graphs:
- Graph 1: Programmatic — portfolio value, amount spent, BTC accumulated
- Graph 2: Fixed DCA — same three lines

Button to toggle between graphs. Toggle-able lines with persistent labels (value remains visible when line is hidden).

Not started. The current `ChartTabs` component exists but does not implement the split layout described in the feature doc.

### Multi-asset support

`hyperliquidSymbol` is configurable, but the bot is otherwise BTC-specific: `hyperliquid-bot.ts` hardcodes the `UBTC` spot target, and:
- The live price display hardcodes `prices["BTC"]` (TD-004)
- The dashboard summary and UI labels assume BTC throughout

Fixing TD-004 and generalizing the spot target token are prerequisites for real multi-asset support.

### Automated indicator data fetching

Reference values (LTH realized price, average realized price, LTH net change) are updated manually each week. Both Bitcoin Magazine Pro and Glassnode have APIs. Automating the fetch would eliminate the weekly manual update and enable the staleness warning to become a true safety net rather than a reminder.

Deferred because the APIs may have costs and the current manual workflow is operationally simple.
