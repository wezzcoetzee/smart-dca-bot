# Reliability

How the bot survives transient failures, avoids double-spending, and reports what it's doing. The core trade path is `runStrategyAsync()` in `lib/strategy.ts`, which delegates order execution to `HyperliquidBot` in `lib/hyperliquid-bot.ts`.

## Retry Logic

### Buy Retries

`executeBuyWithRetry()` in `lib/strategy.ts` retries the spot buy up to **3 times** on transient failures:

```ts
const maxRetries = 3;

if (retryCount < maxRetries) {
    dcaSwapRetryTotal.inc();
    logger.warn(`Retry ${nextRetry}/${maxRetries}: ${error.message}`);
    return await executeBuyWithRetry(..., nextRetry);
}
```

Each retry increments the `dca_swap_retry_total` Prometheus counter.

### Non-Retryable Failures

Two failure classes are never retried:

- **`InsufficientBalanceError`** (or any error message containing `"Insufficient spot balance"`) — retrying cannot succeed without a deposit. `isNonRetryableBuyError()` short-circuits the retry loop.
- **`TransactionSentError`** — the order may already be live (see below).

### Double-Spend Guard

`lib/hyperliquid-bot.ts` throws `TransactionSentError` when an order's outcome is ambiguous rather than a clean failure:

- The Hyperliquid SDK threw an `HttpRequestError` **with** an HTTP response attached (the exchange replied, so the order may have been accepted). A transport error with no response is treated as never-sent and is retryable.
- The order came back `resting` (not immediately filled).
- The status was unrecognized.

`strategy.ts` catches `TransactionSentError` before the retry loop, sends a Discord alert, and re-throws without retrying:

```ts
if (error instanceof TransactionSentError) {
    await sendNotification(`🚨 Order may have been sent — check Hyperliquid manually: ${error.message}`);
    throw error;
}
```

The buy itself is an **IOC (immediate-or-cancel) limit order** priced at `ceil(currentPrice × 1.005)`, so an order either fills (or partially fills) immediately or is cancelled — there is no separate confirmation-polling step.

### Pre-Flight Balance Check

Before placing any order, `runStrategyAsync()` reads spot balances and aborts early if USDC is below `baseAmountToPurchase`, sending a `🛑` Discord alert. `HyperliquidBot.buy()` additionally rejects an order whose notional exceeds the available USDC with `InsufficientBalanceError`.

---

## Error Handling

### Strategy-Level

`runStrategyAsync()` wraps the full execution in try/catch:

- On success: increments `dca_execution_total{status="success"}`
- On failure: increments `dca_execution_total{status="failure"}`, calls `notifyFailureAsync()`, then re-throws

`notifyFailureAsync()` wraps its own Discord call in try/catch so a notification failure cannot mask the original error.

### API Route Error Handling

`app/api/cron/route.ts` returns structured JSON:

```json
// Success
{ "success": true, "amount": 50.00, "reason": "Below LTH Realized Price" }

// Concurrent run blocked
{ "success": false, "error": "Strategy already in progress" }   // HTTP 409

// Failure
{ "success": false, "error": "Internal error" }                 // HTTP 500
```

A concurrent invocation while a run is in progress returns **HTTP 409** rather than starting a second strategy run.

---

## Discord Notifications

Notifications go through `sendNotification()` in `lib/notifications.ts`, which fans out to the Discord webhook (`lib/discord.ts`). Delivery uses `Promise.allSettled`, so a notification failure is logged but never throws into the trade path.

### On Success

After every successful trade, `strategy.ts` sends a Discord message containing:

- Tokens purchased and USD amount spent
- The multiplier reason that triggered
- Hyperliquid wallet balances (BTC quantity + USD value, USDC balance)
- Total USDC spent across all programmatic trades
- Current BTC price
- A configuration staleness warning, if any

### On Failure

`notifyFailureAsync()` sends a failure message with the error message and a UTC timestamp. This fires for any unhandled exception from `runStrategyAsync()`, including `TransactionSentError`.

### Other Alerts

- **Low balance** — when USDC drops below `lowBalanceThreshold`, a `⚠️` deposit reminder is sent.
- **API key expiry** — `lib/key-expiry.ts` warns when the Hyperliquid API key (180-day lifetime) is near or past expiry, with a link to regenerate it.

### Configuration Staleness Alerts

After each successful trade, `strategy.ts` checks whether `MultiplierConfiguration` rows have not been updated within the configured thresholds:

- Warning level: `configWarningWeeks` (default: 1 week)
- Danger level: `configDangerWeeks` (default: 2 weeks)

Stale configs are appended to the success notification with the indicator name and how many weeks stale.

---

## Prometheus Metrics

Metrics are exposed at `/api/metrics` and collected by `prom-client`. All metrics carry the default label `app: 'smart-dca-bot'` plus default Node.js/process metrics.

| Metric | Type | Description |
|--------|------|-------------|
| `bot_runtime_up` | Gauge | Whether the bot runtime is active (1=running, 0=stopped) |
| `dca_execution_total` | Counter | Total executions, labeled `status`: `success` or `failure` |
| `dca_execution_duration_seconds` | Histogram | Full strategy execution duration. Buckets: 1, 5, 10, 30, 60, 120s |
| `dca_purchase_amount_usd` | Gauge | USD amount of the last purchase |
| `dca_btc_price_usd` | Gauge | BTC price at time of execution |
| `dca_multiplier_triggered` | Gauge | Multiplier value applied, labeled by `reason` |
| `dca_tokens_purchased` | Gauge | Tokens purchased in last execution |
| `dca_swap_retry_total` | Counter | Total buy retry attempts |
| `dca_wallet_balance` | Gauge | Wallet balance by `token` label (USDC, BTC) |
| `hyperliquid_order_duration_seconds` | Histogram | Hyperliquid spot order execution duration. Buckets: 0.5, 1, 2, 5, 10, 30s |
| `discord_notification_total` | Counter | Discord notifications, labeled `status`: `success` or `failure` |

---

## Structured Logging

All modules create a named logger via `createLogger({ symbol: "<module>" })`. Log entries include:

- ISO 8601 timestamp
- Level (`DEBUG`, `INFO`, `WARN`, `ERROR`)
- App tag (`[smart-dca-bot]`)
- Module tag (e.g., `[strategy]`, `[hyperliquid-bot]`, `[cron]`)
- Message
- JSON-serialized context (sensitive keys redacted — see [SECURITY.md](./SECURITY.md))
- Error message and stack trace (on error entries)

Log level is controlled by `LOG_LEVEL` (default: `INFO`). Logging can be disabled entirely with `ENABLE_LOGS=false`. In `TEST_MODE=true`, logs are written to an in-memory buffer (`getLogBuffer()`) instead of stdout, letting tests assert on log output without console noise.

Example output:

```
2026-01-15T00:00:01.234Z [INFO ] [smart-dca-bot] [strategy] Current BTC price: $95,000
2026-01-15T00:00:01.300Z [INFO ] [smart-dca-bot] [strategy] LTH_REALIZED_PRICE triggered: $38,599 <= $95,000 (10x)
2026-01-15T00:00:03.100Z [INFO ] [smart-dca-bot] [hyperliquid-bot] HyperliquidBot initialized
```

---

## Docker Health Checks

The web server image (`Dockerfile`) installs `curl` and exposes `GET /api/health` for readiness probes. The cron container's startup routine (`scripts/cron.ts`) polls `/api/health` — up to 30 attempts at 2-second intervals — before scheduling the first cron run.

The cron container does not expose a port or health endpoint. Its liveness is determined by the host process supervisor (Docker restart policy or orchestrator). Recommended restart policy for both containers: `unless-stopped` or `on-failure` with a backoff limit.

## Cross-References

- Execution flow and decisions: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Secret handling and log redaction: [SECURITY.md](./SECURITY.md)
- Test coverage of retry/guard behavior: [QUALITY_SCORE.md](./QUALITY_SCORE.md)
