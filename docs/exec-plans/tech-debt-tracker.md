# Tech Debt Tracker

Known issues and deferred cleanup. Each item includes the file(s) affected and the problem.

---

## TD-001: Duplicate `AppConfig` Interface

**Files**:
- `lib/app-config.ts` (source of truth, exported)
- `app/settings/_components/shared.tsx` (local redefinition)

**Problem**: `shared.tsx` defines its own `AppConfig` interface with the same fields instead of importing from `lib/app-config.ts`. If a field is added or renamed in `lib/app-config.ts`, `shared.tsx` will silently diverge — TypeScript won't catch it because they are structurally compatible until they differ.

**Fix**: In `shared.tsx`, remove the local `AppConfig` definition and import from `@/lib/app-config`.

> Note: the previously-listed `app/settings/page-backup.tsx` redefinition has been deleted; only the `shared.tsx` copy remains.

---

## TD-002: No Input Validation on PUT `/api/app-configuration` — RESOLVED

**File**: `app/api/app-configuration/route.ts`

**Resolution**: The PUT handler now validates the body against a strict Zod schema (`updateSchema.safeParse`, `.strict()`) before calling `updateAppConfig()`, returning 400 with `details` on failure. Bounds are enforced per field (e.g. `baseAmountToPurchase` positive ≤ 10,000; `cronSecret` ≥ 16 chars; `hyperliquidWalletAddress` must match `0x[0-9a-fA-F]{40}`), and unknown fields are rejected.

---

## TD-003: Silent Error Swallow in Staleness Route

**File**: `app/api/configuration-staleness/route.ts`

**Problem**: The catch block returns a success-shaped response on error:

```ts
} catch (error) {
  logger.error("Failed to check configuration staleness", ...);
  return NextResponse.json({ level: null, staleConfigs: [] });
}
```

The client receives HTTP 200 with `{ level: null, staleConfigs: [] }` even when the check failed. The staleness banner in the UI will silently disappear if this route throws, making it impossible to distinguish "no stale configs" from "the check crashed."

**Fix**: Return HTTP 500 in the catch block. The client already handles `level: null` as the no-alert state, so distinguishing an actual error requires a non-2xx status.

---

## TD-004: Hardcoded `"BTC"` in Dashboard Price Subscription

**File**: `app/page.tsx`, line 57

**Problem**:

```ts
const livePrice = prices["BTC"];
```

The Hyperliquid WebSocket hook returns a `prices` map keyed by symbol. This line hardcodes `"BTC"` instead of reading `targetTokenSymbol` or `hyperliquidSymbol` from app config or dashboard data.

If the bot is configured to trade a different asset (the system supports this — `hyperliquidSymbol` is configurable), the live price display will always show BTC and the ticker will be incorrect.

**Fix**: Derive the symbol from `data?.summary` or pass it through the dashboard API response. Use that value to key into `prices`.

---

## TD-005: `LTH_BUYING` Evaluated Before `AVERAGE_REALIZED_PRICE`

**File**: `lib/strategy.ts`, `determineAmountToBuyAsync()`

**Problem**: `features/programatic_buying.md` ranks indicators as:

1. LTH Realized Price (highest)
2. Average Realized Price
3. LTH Buying
4. Moving Average (lowest)

The code evaluates them in this order: LTH Realized Price → **LTH Buying** → Average Realized Price → Moving Average. Rank 2 and Rank 3 are swapped.

Both carry the same 5x multiplier so the financial impact is zero today, but the evaluation order no longer matches the documented intent.

**Fix**: Reorder the checks in `determineAmountToBuyAsync()` to match the documented priority: LTH Realized Price → Average Realized Price → LTH Buying → Moving Average.
