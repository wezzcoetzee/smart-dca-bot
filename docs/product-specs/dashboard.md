# Dashboard

Route: `/`
Source: `app/page.tsx`, `app/api/dashboard/route.ts`

---

## Overview

The dashboard is the primary view. It renders a live BTC price ticker, a period-scoped dual DCA comparison chart, and a table of programmatic transactions. On first load a full-page loader is shown until both the API response and animation complete.

---

## Components

### Live Price Display

- Source: `components/dashboard/live-price-display.tsx`
- Price data comes from `useHyperliquidPrices`, a hook that maintains a WebSocket connection to Hyperliquid
- Displays current BTC price and connection status
- Shows summary stats from the current period: programmatic BTC accumulated, fixed BTC accumulated, and percentage difference between them

### Period Selector

- Options: `1m` (1 month), `1y` (1 year), `all` (from 2025-01-01)
- Changing the period triggers a new fetch to `/api/dashboard?period=<value>`
- Previous in-flight requests are cancelled via `AbortController`

### Chart Tabs

- Source: `components/dashboard/chart-tabs.tsx`
- Renders `ChartDataPoint[]` from the API response
- Shows cumulative portfolio value (programmatic vs fixed), BTC accumulated, and USD spent over time

### Transaction Table

- Source: `components/dashboard/transaction-table.tsx`
- Displays `PROGRAMATIC` transactions only, in reverse chronological order
- Columns: date, amount (token), price (USD), reason

### Trigger Bot Button

- Source: `components/trigger-bot-button.tsx`
- Manually invokes `/api/cron` from the UI for testing

---

## API: `GET /api/dashboard`

### Query Parameters

| Parameter | Type | Default | Values |
|-----------|------|---------|--------|
| `period` | string | `1m` | `1m`, `1y`, `all` |

### Date Ranges

| Period | Range |
|--------|-------|
| `1m` | Last 1 month |
| `1y` | Last 1 year |
| `all` | 2025-01-01 to now |

### Response

```json
{
  "chartData": [
    {
      "date": "2025-06-01",
      "programaticValue": 1234.56,
      "fixedValue": 1100.00,
      "btcPrice": 68000.00,
      "programaticBtcAccumulated": 0.01816,
      "fixedBtcAccumulated": 0.01617,
      "programaticSpent": 150.00,
      "fixedSpent": 125.00
    }
  ],
  "transactions": [
    {
      "id": "uuid",
      "date": "2025-06-01T00:00:00.000Z",
      "amount": 0.00147,
      "price": 68000.00,
      "reason": "LTH Realized Price below threshold"
    }
  ],
  "summary": {
    "currentPrice": 68000.00,
    "totalProgramaticValue": 1234.56,
    "totalFixedValue": 1100.00,
    "programaticBtcAmount": 0.01816,
    "fixedBtcAmount": 0.01617,
    "percentageDifference": 12.23
  }
}
```

### Chart Data Calculation

The API builds `chartData` by iterating all transactions in the period in ascending date order, accumulating separate running totals for `PROGRAMATIC` and `FIXED` types. Each `ChartDataPoint` captures portfolio value at the price of that transaction.

`percentageDifference = ((programaticValue - fixedValue) / fixedValue) * 100`

Returns `0` if `fixedValue` is `0`.

### Errors

| Status | Body | Cause |
|--------|------|-------|
| 500 | `{ "error": "Failed to fetch dashboard data" }` | DB or price feed failure |

---

## Live Price WebSocket

The `useHyperliquidPrices` hook connects to Hyperliquid's WebSocket feed. The `prices["BTC"]` value updates in real time. `isConnected` reflects the current connection state and is shown in the UI.

The Hyperliquid symbol used for the live price is always `"BTC"` in the UI hook, independent of the `hyperliquidSymbol` stored in `AppConfiguration` (which is used server-side for the dashboard API).

---

## Loading States

1. `FullPageLoader` shown until both `dataReady` is true and the loader animation completes
2. `DashboardSkeleton` shown within the page on subsequent period changes while `loading` is true
3. Error state: red error message centered in the chart area
