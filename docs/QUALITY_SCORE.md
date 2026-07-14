# Quality

## TypeScript

Strict mode enabled across the project.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "noEmit": true
  }
}
```

`strict: true` enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and the full strict family. `isolatedModules: true` enforces single-file transpilability (required for the Bun runtime).

**Rules (enforced by convention, not suppression):**
- No `any` without an explicit justification comment
- No `@ts-ignore` or `@ts-expect-error`
- Use `unknown` when the type is genuinely unknown
- Exported functions carry explicit return types

Path alias `@/*` maps to the project root, used consistently across all imports.

---

## Test Runner

Bun's built-in test runner (`bun:test`). Tests live alongside source files with a `.test.ts` suffix.

```bash
bun test                                    # run all tests
bun test --watch                            # watch mode
bun test lib/strategy.test.ts               # single file
bun test --coverage                         # coverage report
```

The `test` script in `package.json` calls `./run-tests.sh` which wraps the Bun invocation (allows pre/post hooks).

### Test conventions

- `describe` / `test` nesting mirrors module structure
- `mock.module()` for dependency injection — replaces entire modules before the import under test
- `mock.restore()` in `afterEach` to prevent cross-test contamination
- `process.env` is saved and restored around each test to isolate env-dependent behaviour

### Strategy test coverage (`lib/strategy.test.ts`)

`determineAmountToBuyAsync`:
- Returns base amount when no multipliers exist
- Returns base amount when multipliers are disabled
- Applies `LTH_REALIZED_PRICE` multiplier when price is at or below threshold
- Does not apply `LTH_REALIZED_PRICE` when price is above threshold
- Applies `LTH_BUYING` when value is `"true"`, skips when `"false"`
- Applies `AVERAGE_REALIZED_PRICE` when price is below average
- Applies `MOVING_AVERAGE` when price is below the calculated SMA
- Prioritizes `LTH_REALIZED_PRICE` over all other conditions (priority enforcement)
- Falls through to next indicator when higher-priority condition is not met
- Handles invalid, zero, and negative day values for `MOVING_AVERAGE` (graceful fallback)
- Handles exact price match on threshold (inclusive trigger)
- Handles multiple rows of the same type (uses first match)
- Handles large and fractional multiplier values

`runStrategyAsync`:
- Orchestrates full flow and returns correct result shape
- Saves both `PROGRAMATIC` and `FIXED` transaction records per execution
- Sends Discord notification on success
- Sends failure notification when any step throws
- Retries failed buys up to 3 attempts
- Does not retry when `TransactionSentError` is thrown (double-spend guard)

---

## Linting

ESLint 9 with `eslint-config-next`.

```bash
bun run lint
```

`lint-staged` runs ESLint against staged `.ts`, `.tsx`, `.js`, `.jsx` files before every commit.

---

## Pre-commit Hook

Husky 9 manages Git hooks. The pre-commit hook runs:

```sh
bunx lint-staged
```

This blocks commits containing ESLint errors. Warnings do not block.

Setup runs automatically via the `prepare` npm lifecycle script (`husky`), which executes on `bun install`.

---

## Prometheus Metrics

`lib/metrics.ts` exports a `prom-client` registry with default Node.js metrics plus the following custom metrics:

| Metric name | Type | Description |
|-------------|------|-------------|
| `bot_runtime_up` | Gauge | Whether the bot runtime is active (1=running, 0=stopped) |
| `dca_execution_total` | Counter | Execution count by `status` label |
| `dca_execution_duration_seconds` | Histogram | Strategy execution duration; buckets: 1, 5, 10, 30, 60, 120s |
| `dca_purchase_amount_usd` | Gauge | USD amount of the last purchase |
| `dca_btc_price_usd` | Gauge | BTC price at execution time |
| `dca_multiplier_triggered` | Gauge | Multiplier value applied, labelled by `reason` |
| `dca_tokens_purchased` | Gauge | Token quantity purchased in last execution |
| `dca_swap_retry_total` | Counter | Total buy retries |
| `dca_wallet_balance` | Gauge | Wallet balance by `token` label |
| `hyperliquid_order_duration_seconds` | Histogram | Hyperliquid spot order duration; buckets: 0.5, 1, 2, 5, 10, 30s |
| `discord_notification_total` | Counter | Discord notification count by `status` label |

All metrics share the default label `app: "smart-dca-bot"`.

The registry is exported as `metricsRegistry` for use in the `/api/metrics` route handler (Prometheus scrape endpoint).

---

## Dependency Management

- Package manager: Bun (no npm/yarn)
- `bun install` respects `trustedDependencies` to allow postinstall scripts for `sharp` and `unrs-resolver`
- `ignoreScripts` prevents unintended execution from those same packages in other contexts
- Dependabot configured for GitHub Actions version bumps
