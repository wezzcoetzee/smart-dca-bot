# Product Sense

## What It Is

Smart DCA Bot automates Bitcoin spot purchases on Hyperliquid using a multiplier strategy tied to on-chain market indicators. Instead of buying a fixed dollar amount every cycle, the bot scales purchase size up when the market is statistically cheap — and defaults to the base amount otherwise.

The dashboard visualizes whether the dynamic strategy has outperformed a fixed DCA approach since any given start date.

---

## The Core Problem

Standard DCA ignores market conditions. A fixed $10/day buyer spends the same when BTC is at an all-time high as when it is near long-term holder cost basis. The bot solves this by concentrating buying power at high-signal moments (bear market capitulation, LTH accumulation) while maintaining a baseline purchase cadence during neutral conditions.

---

## User Mental Model

The intended operator is a technical individual who:
1. Runs the bot once configured and does not touch it daily
2. Updates three or four reference values weekly (LTH realized price, market realized price, LTH net change flag)
3. Reviews the dashboard periodically to confirm the strategy is beating fixed DCA
4. Receives Discord notifications after every purchase

The UI is not for the general public. It is a personal operations dashboard. The settings pages expose all system parameters; the dashboard page answers one question: "Is this working?"

---

## Core Flows

### 1. Configure

1. Set `DATABASE_URL` and `DB_ENCRYPTION_KEY` as environment variables.
2. Open `/settings/hyperliquid` and save the Hyperliquid API wallet credentials (private key, master wallet address, key creation date). The key is encrypted at rest.
3. Configure the remaining settings via the sidebar pages:
   - **Trading**: low USDC balance threshold
   - **DCA**: base purchase amount, Hyperliquid price symbol
   - **Multiplier Settings**: threshold values and multipliers for each of the four indicators
   - **Notifications**: Discord webhook URL and enable toggle
   - **Schedule**: cron secret used to authenticate `/api/cron`
   - **Staleness Alerts**: warning/danger thresholds
4. The configuration staleness banner appears globally when multiplier reference values have not been updated within the configured warning window.

### 2. Execute

The cron scheduler calls `/api/cron` (authenticated with a `Bearer` cron secret) on the configured schedule. Each execution:

1. Reads config and decrypts the Hyperliquid API key
2. Checks spot balances; aborts with a Discord alert if USDC is below the base amount
3. Fetches the current BTC price from the Hyperliquid feed
4. Reads multiplier configuration from the database
5. Evaluates indicators in priority order — first match wins, no stacking
6. Executes a Hyperliquid spot buy (USDC → BTC) as an IOC limit order for the calculated USD amount
7. Saves two transaction records: one `PROGRAMATIC` (actual amount) and one `FIXED` (base amount benchmark)
8. Sends a Discord notification with the trade summary

The buy retries up to 3 times on transient failures. A `TransactionSentError` (order outcome ambiguous) is not retried.

### 3. Review

The dashboard (`/`) shows:
- Live BTC price via the Hyperliquid WebSocket feed
- Programmatic portfolio value vs fixed DCA portfolio value, with percentage difference
- Recharts line chart toggled between programmatic and fixed series
- Programmatic transaction history: date, amount, BTC price, multiplier reason
- Time range selector: 1 month, 1 year, all time

---

## Indicator Priority

The four indicators, highest to lowest priority **as implemented**:

| Priority | Type | Typical multiplier | Trigger condition |
|----------|------|-------------------|-------------------|
| 1 | LTH Realized Price | 10x | Price ≤ LTH realized price |
| 2 | LTH Net Change | 5x | LTH net change flag is `"true"` (accumulating) |
| 3 | Market Realized Price | 5x | Price ≤ average realized price |
| 4 | Moving Average | 1.5x | Price ≤ N-day SMA |

Only one multiplier applies per execution. If no condition is met, the base amount is purchased. (Priorities 2 and 3 are swapped relative to the documented intent — tracked as TD-005; both carry 5x so there is no financial impact today.) See [design-docs/multiplier-strategy.md](./design-docs/multiplier-strategy.md).

---

## Product Principles

**Set-and-forget reliability.** The bot must run unattended. Failures trigger Discord alerts and retry logic. The staleness banner reminds the operator to update reference values.

**Transparency over black boxes.** Every purchase records both what was bought and what a fixed strategy would have bought. The dashboard makes the comparison legible over any time horizon.

**Configuration over code.** All trading parameters live in the database, editable through the UI. No code changes are required to adjust strategy thresholds.

**Minimal interface.** The dashboard answers one question per screen. No charts-for-the-sake-of-charts, no gamification, no noise.

---

## Anti-Goals

- Not a multi-user SaaS product. There is no authentication, no tenancy, no user accounts.
- Not a general-purpose trading bot. It only buys (DCA in). It does not sell, hedge, or manage risk.
- Not a real-time trading system. The cron schedule is coarse (twice daily default). Latency optimization is not a concern.
- Not a mobile-first product. The dashboard is designed for desktop review, not mobile operation.
- Not automated reference-value updating. Indicator thresholds (LTH realized price, market realized price) are intentionally manual — they require human judgment and are updated weekly.
