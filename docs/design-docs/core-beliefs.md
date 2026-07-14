# Core Beliefs

Foundational design decisions. Changing these requires rethinking significant parts of the system.

## 1. DB-Backed Configuration

All operational settings live in the single-row `AppConfiguration` table and are editable via `/settings` in the UI. `lib/app-config.ts`'s `getAppConfig()` reads the row directly — there is no environment-variable fallback for these fields.

**What belongs in DB**: base purchase amount, Hyperliquid price symbol, low-balance threshold, cron secret, Discord webhook URL + enable flag, encrypted Hyperliquid API key (private key, wallet address, key creation date), and staleness thresholds.

**What belongs in ENV only**: `DATABASE_URL` and `DB_ENCRYPTION_KEY` (needed before any DB read), `CRON_EXPRESSION`, and runtime flags (`TEST_MODE`). These are bootstrap secrets or deployment-level concerns.

**Why**: Operators should be able to tune the bot without redeploying. The settings UI makes this safe, and secrets stored in the DB are encrypted (the API key) or masked in API responses.

## 2. Priority-Based Multipliers, No Stacking

When multiple market conditions are true simultaneously, only the highest-priority matching condition applies. Multipliers never compound.

Evaluation order (first match wins):

1. LTH Realized Price (10x)
2. Average Realized Price (5x)
3. LTH Buying (5x)
4. Moving Average (1.5x)

(This is the intended ranking. The code currently evaluates LTH Buying before Average Realized Price — both 5x, so no financial impact today. Tracked as TD-005.)

**Why no stacking**: If BTC is simultaneously below the LTH realized price, below the average realized price, and below the moving average, stacking would produce a 75x purchase (`10 × 5 × 1.5`). At a $5 base that is $375 per trade — unacceptable risk. The priority order captures the most meaningful signal and stops there.

**Implementation**: `determineAmountToBuyAsync()` in `lib/strategy.ts` uses early returns. Each indicator check returns immediately on match; later indicators are never evaluated.

## 3. Dual DCA Tracking

Every trade records two transactions:

- `PROGRAMATIC` — the actual amount purchased after multiplier evaluation
- `FIXED` — what a naive fixed-amount strategy would have bought (`baseAmount / currentPrice`)

Both use the same price and timestamp. Neither transaction represents a second swap — only the `PROGRAMATIC` amount is actually executed on-chain. The `FIXED` record is a synthetic benchmark.

**Why**: The dashboard can plot both equity curves over time, giving the operator a clear view of whether the dynamic strategy outperforms a simple daily DCA. Without dual recording, this comparison is impossible to reconstruct retroactively.

## 4. Module-Mock Testing Seam

Core logic imports its collaborators (Prisma, the Hyperliquid price feed, the Hyperliquid bot, Discord notifications) directly. Tests isolate it with Bun's `mock.module()`, which replaces an entire module before the unit under test imports it — so `strategy.ts` and the multiplier logic can be unit-tested without a database connection, live price feed, or Discord webhook.

Because `mock.module()` state leaks within a process, `run-tests.sh` runs **each test file in its own `bun test` process**.

**Why**: The bot runs on a schedule and touches real funds. Confidence that the trading logic is correct matters more than test convenience, and per-file process isolation keeps module mocks from contaminating each other.

## 5. Single-Row Configuration Table

`AppConfiguration` uses a fixed primary key (`"default"`). There is exactly one row, always. Updates use `upsert`.

**Why**: Configuration is not multi-tenant. Treating it as a key-value store with arbitrary rows would complicate queries and the UI with no benefit.
