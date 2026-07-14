# Settings

Route: `/settings`
Source: `app/settings/layout.tsx`, `app/settings/*/page.tsx`, `app/settings/_components/shared.tsx`
API: `app/api/app-configuration/route.ts`, `app/api/multiplier-configuration/route.ts`

---

## Overview

The settings area is a sidebar-navigation layout with seven sub-pages. All sub-pages except Multiplier Settings read and write `AppConfiguration` via `/api/app-configuration`. Multiplier Settings reads and writes `MultiplierConfiguration` rows via `/api/multiplier-configuration`.

Configuration is DB-backed: every field on these pages persists to the database and is read back directly by the bot — there is **no** environment-variable fallback for `AppConfiguration` fields. Secrets are returned masked as `"••••••••"` from `GET /api/app-configuration` and are only overwritten when the operator submits a new value.

---

## Layout

Sidebar nav links (from `app/settings/layout.tsx`):

| Label | Route |
|-------|-------|
| Multiplier Settings | `/settings/multiplier-settings` |
| Trading | `/settings/trading` |
| DCA | `/settings/dca` |
| Notifications | `/settings/notifications` |
| Schedule | `/settings/schedule` |
| Hyperliquid | `/settings/hyperliquid` |
| Staleness Alerts | `/settings/staleness` |

Active link is highlighted white; inactive links are `#666666`.

---

## Sub-pages

### Multiplier Settings

Route: `/settings/multiplier-settings`

Displays one item for each of the four `MultiplierType` values (`MOVING_AVERAGE`, `LTH_REALIZED_PRICE`, `AVERAGE_REALIZED_PRICE`, `LTH_BUYING`). Each item can be saved independently.

Each item exposes:
- **Value** — the reference price/threshold (string, manually updated weekly)
- **Multiplier** — the purchase amount multiplier (float)
- **Enabled** — toggle to activate/deactivate this indicator

Saves via `PATCH /api/multiplier-configuration` (upsert by `type`).

---

### Trading

Route: `/settings/trading`

| Field | DB Column | Notes |
|-------|-----------|-------|
| Low Balance Threshold | `lowBalanceThreshold` | USDC balance below this triggers a Discord warning; float |

---

### DCA

Route: `/settings/dca`

| Field | DB Column | Notes |
|-------|-----------|-------|
| Base Purchase Amount | `baseAmountToPurchase` | Base USD amount per purchase before multipliers; float |
| Hyperliquid Symbol | `hyperliquidSymbol` | Symbol used to fetch price data (e.g. `BTC`) |

---

### Notifications

Route: `/settings/notifications`

| Field | DB Column | Notes |
|-------|-----------|-------|
| Enabled | `discordEnabled` | Master toggle (header switch) |
| Webhook URL | `discordWebhookUrl` | Discord channel webhook; input type `password` |

**Send Test Message button:** Posts to `POST /api/test-discord`. Disabled while `discordEnabled` is off. Sends a test notification to the configured webhook.

---

### Schedule

Route: `/settings/schedule`

| Field | DB Column | Notes |
|-------|-----------|-------|
| Cron Secret | `cronSecret` | Bearer secret required in the `Authorization` header on `/api/cron`; input type `password`; min 16 chars |

Note: `CRON_EXPRESSION` (the schedule itself) is an ENV-only variable on the cron container and is not configurable here.

---

### Hyperliquid

Route: `/settings/hyperliquid`

| Field | DB Column | Notes |
|-------|-----------|-------|
| API Private Key | `hyperliquidPrivateKey` | API wallet private key from app.hyperliquid.xyz/API; input type `password`; encrypted at rest (AES-256-GCM) |
| Wallet Address | `hyperliquidWalletAddress` | Master wallet address used for balance queries; `0x…` 40-hex |
| Key Created Date | `hyperliquidKeyCreatedDate` | Date input; drives the 180-day expiry warning |

This page submits only the three Hyperliquid fields on save.

---

### Staleness Alerts

Route: `/settings/staleness`

| Field | DB Column | Default | Notes |
|-------|-----------|---------|-------|
| Warning Threshold (weeks) | `configWarningWeeks` | 1 | Warning banner if `MultiplierConfiguration.updatedAt` is older than this (1–52) |
| Danger Threshold (weeks) | `configDangerWeeks` | 2 | Danger banner if older than this (1–52) |

These thresholds drive the check in `/api/configuration-staleness`, which the UI polls to display alerts when multiplier reference values have not been updated recently.

---

## API Reference

### `GET /api/app-configuration`

Returns the current `AppConfiguration` row with secrets masked.

```json
{ "success": true, "data": { "baseAmountToPurchase": 5, "discordEnabled": true, "cronSecret": "••••••••", ... } }
```

### `PUT /api/app-configuration`

Validates the body against a strict Zod schema and updates the row. Masked values (`"••••••••"`) for `cronSecret`, `discordWebhookUrl`, `hyperliquidWalletAddress`, and `hyperliquidPrivateKey` are dropped (left unchanged). A new `hyperliquidPrivateKey` is encrypted before storage.

```json
{ "success": true, "data": null }
```

Validation highlights: `baseAmountToPurchase` positive ≤ 10,000; `cronSecret` ≥ 16 chars; `discordWebhookUrl` must be a URL; `hyperliquidWalletAddress` must match `0x[0-9a-fA-F]{40}`; `configWarningWeeks`/`configDangerWeeks` ints 1–52. Unknown fields are rejected (`.strict()`). Returns 400 with `details` on validation failure.

### `GET /api/multiplier-configuration`

Returns all `MultiplierConfiguration` rows.

```json
[
  { "id": "uuid", "type": "LTH_REALIZED_PRICE", "value": "38599", "multiplier": 10.0, "enabled": true, "updatedAt": "..." }
]
```

### `PATCH /api/multiplier-configuration`

Upserts a single multiplier row.

Request body:
```json
{ "type": "LTH_REALIZED_PRICE", "value": "38599", "multiplier": 10.0, "enabled": true }
```

Validation (Zod):
- `type`: must be a valid `MultiplierType` enum value
- `value`: non-empty string
- `multiplier`: finite number
- `enabled`: optional boolean

| Status | Cause |
|--------|-------|
| 200 | Success; returns updated row |
| 400 | Zod validation failure; includes `details` array |
| 500 | DB error |
