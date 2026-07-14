# Hyperliquid Spot BTC DCA — Design Spec

## Summary

Replace the Solana/Jupiter swap layer with Hyperliquid spot trading via `@nktkas/hyperliquid` SDK. The bot will DCA into native BTC on Hyperliquid's spot market using USDC. Manual USDC deposits; manual BTC withdrawals (quarterly/semi-annually). Everything else — strategy, multipliers, cron, dashboard — stays the same.

## Motivation

- Native BTC (not wrapped/bridged)
- Lower fees/slippage vs Jupiter
- USDC already on Hyperliquid
- Consolidate trading to one venue

## Architecture

### What Changes

| Component | Current (Solana) | New (Hyperliquid) |
|-----------|-----------------|-------------------|
| `lib/solana-bot.ts` | Jupiter swap + transfer to cold wallet | **Removed** |
| `lib/solana.ts` | BIP39 → ED25519 wallet derivation | **Removed** |
| `lib/hyperliquid-bot.ts` | N/A | **New** — spot market buy, balance checks |
| `lib/strategy.ts` | Calls SolanaBot | Calls HyperliquidBot |
| `lib/app-config.ts` | Solana-specific fields | Hyperliquid-specific fields |
| Prisma schema | Solana config columns | Drop Solana columns, add `lowBalanceThreshold` |
| Settings UI | Solana fields | Hyperliquid fields |
| Dashboard | Solana wallet balances | Hyperliquid spot balances |

### What Stays the Same

- `lib/strategy.ts` orchestration flow (multipliers, transaction recording, Discord alerts)
- `lib/hyperliquid.ts` (price feed + SMA — already exists, unchanged)
- Cron setup (`scripts/cron.ts` + `/api/cron` route)
- Transaction table schema (PROGRAMATIC vs FIXED comparison)
- Multiplier configuration
- Dashboard charts and transaction history

## Hyperliquid Bot (`lib/hyperliquid-bot.ts`)

### Wallet Derivation

- Reuse existing `MNEMONIC` env var
- Derive EVM wallet using Ethereum path `m/44'/60'/0'/0/0` (Hyperliquid is EVM-based)
- Use `viem` for derivation (includes BIP39 support, replaces old `bip39` + `ed25519-hd-key` deps)

### Public Interface

```typescript
buy(usdAmount: number): Promise<{ filledQty: number; avgPrice: number; orderId: string }>
getBalances(): Promise<{ usdc: number; btc: number }>
checkLowBalance(threshold: number): boolean  // based on cached balance from getBalances
```

### Order Execution

- Spot market buy on `BTC/USDC` pair
- Poll order status until filled or failed (don't assume immediate fill)
- Partial fills: record what was filled, don't retry the remaining amount
- Timeout after 30s of polling → log order ID, alert Discord, don't retry (prevents double-buys)

### Resilience

**Pre-trade checks:**
- Check USDC balance before placing order
- If balance < trade amount → skip trade, alert Discord
- If balance < `lowBalanceThreshold` but sufficient for trade → send low-balance warning, proceed with buy

**Order lifecycle:**
- Network error before order reaches exchange → safe to retry next cron cycle (no order placed)
- Order placed but process crashes before DB write → duplicate buy on next cycle is acceptable (small DCA amount), but log Discord warning if last transaction was within a short window
- Order rejected by exchange → retry once, then throw

**Rate limiting:**
- Respect Hyperliquid rate limits in SDK client config

## Strategy Changes (`lib/strategy.ts`)

1. Initialize `HyperliquidBot` instead of `SolanaBot`
2. Before buying: check balance, send low-balance warning if needed
3. Call `hyperliquidBot.buy(amount)` instead of `solanaBot.buyAndTransferAsync(amount)`
4. Record transaction with filled quantity and USD amount (same as today)
5. No post-trade transfer step (BTC stays on Hyperliquid)

**Removed from strategy:**
- SolanaBot initialization
- Post-swap transfer to cold wallet
- SOL gas balance checks

## Config & Schema Changes

### AppConfig Fields Removed

- `rpcEndpoint`
- `jupiterApiKey`
- `destWallet`
- `slippage`
- `sellingTokenAddress`
- `buyingTokenAddress`
- `targetTokenDecimals`

### AppConfig Fields Added

- `lowBalanceThreshold` (number, default: 100) — USDC threshold for Discord warning

### AppConfig Fields Kept

- `baseAmountToPurchase`
- `targetTokenSymbol`
- `hyperliquidSymbol`
- `discordWebhookUrl`
- `discordEnabled`
- `cronSecret`
- `configWarningWeeks`
- `configDangerWeeks`

### Prisma Migration

- Drop removed columns from `AppConfiguration`
- Add `lowBalanceThreshold` column (Float, default: 100)

### Dependencies Removed

- `@jup-ag/api`
- `@solana/web3.js`
- `@solana/spl-token`
- `bip39`
- `ed25519-hd-key`

### Dependencies Added

- `@nktkas/hyperliquid`
- `viem` (EVM wallet derivation from mnemonic)

## Settings UI

- Remove fields: RPC endpoint, Jupiter API key, destination wallet, slippage, selling token address, buying token address, token decimals
- Add field: low balance threshold (number input, USDC)
- Keep all other existing fields

## Dashboard

- Wallet balance display: show Hyperliquid USDC and BTC spot balances
- Remove SOL gas balance indicator
- Transaction history and ROI comparison unchanged

## Out of Scope

- Automated USDC deposits to Hyperliquid
- Automated BTC withdrawals from Hyperliquid
- Multi-exchange support / exchange abstraction layer
- Advanced order types (TWAP, limit orders)
