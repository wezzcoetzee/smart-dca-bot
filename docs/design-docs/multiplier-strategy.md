# Multiplier Strategy

How the bot decides how much to buy on each execution.

## Overview

The base purchase amount (`baseAmountToPurchase` from `AppConfiguration`) is multiplied by a factor derived from market conditions. Four indicators are evaluated in priority order. The first matching condition determines the multiplier — no stacking.

If no condition matches, the base amount is used unchanged.

## Indicators

### 1. LTH Realized Price — Priority 1 of 4

| Field | Value |
|-------|-------|
| DB type | `LTH_REALIZED_PRICE` |
| `value` field | Price in USD (e.g., `"38599"`) |
| Default multiplier | 10x |
| Data source | [Bitcoin Magazine Pro](https://www.bitcoinmagazinepro.com/api/docs/#available-metrics) — metric `lth-realized-price` |

The average cost basis of long-term holders (coins unmoved 155+ days). When price falls to or below this level, historically it marks bear market bottoms where LTH stop selling.

**Trigger**: `lthRealizedPrice >= currentPrice`

**Example**: Base $5, LTH realized price $38,599, current BTC $35,000 → buy $50.

Note: an earlier spec described a secondary trigger (within 5% above the price). The current implementation in `strategy.ts` only triggers at or below the LTH price. The 5% buffer is not implemented.

### 2. Average Realized Price — Priority 2 of 4

| Field | Value |
|-------|-------|
| DB type | `AVERAGE_REALIZED_PRICE` |
| `value` field | Price in USD (e.g., `"56196"`) |
| Default multiplier | 5x |
| Data source | [Bitcoin Magazine Pro](https://www.bitcoinmagazinepro.com/api/docs/#available-metrics) — metric `realized-price` |

The average cost basis across all market participants. Prices below this level mean the average holder is underwater — historically a strong buy signal.

**Trigger**: `avgRealizedPrice >= currentPrice`

**Example**: Base $5, realized price $56,196, current BTC $50,000 → buy $25.

### 3. LTH Buying (Net Change) — Priority 3 of 4

| Field | Value |
|-------|-------|
| DB type | `LTH_BUYING` |
| `value` field | `"true"` or `"false"` |
| Default multiplier | 5x |
| Data source | [Glassnode](https://docs.glassnode.com/) — metric `supply.LthNetChange` |

Long-term holders have historically strong market timing. When their aggregate position is growing (net change positive), follow their accumulation.

**Trigger**: `value === "true"`

This indicator requires manual weekly updates. Check whether LTH net change is positive and set the DB value to `"true"` or `"false"` accordingly.

**Example**: Base $5, value `"true"` → buy $25.

### 4. Moving Average — Priority 4 of 4

| Field | Value |
|-------|-------|
| DB type | `MOVING_AVERAGE` |
| `value` field | Number of days as string (e.g., `"44"`) |
| Default multiplier | 1.5x |
| Data source | Hyperliquid — fetched live each run |

Simple moving average calculated dynamically from Hyperliquid historical price data. Price below the SMA indicates bearish short-term conditions.

**Trigger**: `SMA(N days) >= currentPrice`

Unlike the other indicators, this one fetches live data on every execution. The `value` field controls the lookback period. Changing it from `"44"` to `"50"` switches to a 50-day SMA with no code changes.

**Example**: Base $5, 44-day SMA $42,000, current BTC $40,000 → buy $7.50.

## Evaluation Logic

```
1. Is LTH_REALIZED_PRICE enabled AND price ≤ lthRealizedPrice?
   → return base × 10x

2. Is LTH_BUYING enabled AND value === "true"?
   → return base × 5x

3. Is AVERAGE_REALIZED_PRICE enabled AND price ≤ avgRealizedPrice?
   → return base × 5x

4. Is MOVING_AVERAGE enabled AND price ≤ SMA(N)?
   → return base × 1.5x

5. No match → return base × 1x, reason "No multiplier conditions met"
```

Disabled rows (the `enabled` column) are skipped entirely.

Each condition returns immediately — subsequent conditions are not evaluated.

## Example Scenario

Base amount: $5, current BTC: $35,000

| Indicator | Threshold | Met? |
|-----------|-----------|------|
| LTH Realized Price | $38,599 | Yes (35,000 < 38,599) |
| Average Realized Price | $56,196 | Yes |
| Moving Average (44D) | $42,000 | Yes |

Result: **$50** — LTH Realized Price matched first, evaluation stops.

## Configuration Schema

Stored in `multiplier_configuration` table:

| Column | Type | Description |
|--------|------|-------------|
| `type` | `MultiplierType` enum | `MOVING_AVERAGE`, `LTH_REALIZED_PRICE`, `AVERAGE_REALIZED_PRICE`, `LTH_BUYING` |
| `value` | `String` | Threshold or parameter; interpretation depends on type |
| `multiplier` | `Float` | Factor applied when condition triggers |
| `enabled` | `Boolean` | Whether this indicator is evaluated |

### Initial SQL

```sql
INSERT INTO multiplier_configuration (type, value, multiplier, enabled) VALUES
  ('LTH_REALIZED_PRICE',    '38599', 10.0, true),
  ('AVERAGE_REALIZED_PRICE','56196',  5.0, true),
  ('LTH_BUYING',            'false',  5.0, true),
  ('MOVING_AVERAGE',        '44',     1.5, true);
```

### Updating Thresholds

Update weekly or when on-chain metrics shift meaningfully.

```sql
-- Update realized price reference values
UPDATE multiplier_configuration SET value = '60000' WHERE type = 'AVERAGE_REALIZED_PRICE';
UPDATE multiplier_configuration SET value = '42000' WHERE type = 'LTH_REALIZED_PRICE';

-- Toggle LTH buying signal
UPDATE multiplier_configuration SET value = 'true' WHERE type = 'LTH_BUYING';

-- Change moving average period
UPDATE multiplier_configuration SET value = '50' WHERE type = 'MOVING_AVERAGE';
```

Alternatively, use the `/settings/multiplier-settings` page in the UI.

## Alternatives Considered

**Stacking multipliers**: Apply all matching multipliers multiplicatively. Rejected because simultaneous triggers (common in bear markets when everything is below thresholds) would produce extreme purchase sizes. A 10× 5× 1.5× stack = 75× base, turning a $5 trade into $375.

**Additive multipliers**: Sum matching multiplier values rather than pick the highest. Also rejected — still compounds unexpectedly and loses the semantic meaning of each indicator.

**Percentage-based thresholds**: Express thresholds as % below ATH or % below a rolling average rather than absolute prices. Not implemented because the reference metrics (realized price, LTH realized price) are already meaningful absolute values that operators understand.

**Automated data fetching**: Pull realized price and LTH net change from APIs automatically on each run. Rejected as the initial implementation — these metrics change slowly, API costs add up, and manual weekly updates are operationally simple. Can be added later without changing the evaluation logic.

## Implementation Notes

- `determineAmountToBuyAsync()` in `lib/strategy.ts` owns all evaluation logic
- The function is exported and independently testable — `runStrategyAsync()` calls it but does not contain any indicator logic itself
- LTH_BUYING check happens before AVERAGE_REALIZED_PRICE in the code despite `features/programatic_buying.md` listing them as Rank 3 and Rank 2 respectively — this is a discrepancy to resolve (tracked as TD-005)
- Moving average is the only indicator that makes a network call; the others read static DB values
