# Replace Mnemonic with Hyperliquid API Key Authentication

## Summary

Replace the `MNEMONIC` env var with DB-stored Hyperliquid API wallet credentials managed via the Settings UI. Add AES-256 encryption for the private key at rest. Warn via the configured notification channel when the key is within 7 days of the 180-day expiry.

## Motivation

Hyperliquid API wallet keys can be scoped to specific permissions (e.g. spot trading only), making them more secure than a full seed phrase. Storing credentials in the DB lets users rotate keys without redeploying.

## Changes

### 1. Database schema

Add three fields to `AppConfiguration`:

- `hyperliquidPrivateKey` (`String`, default `""`) — AES-256 encrypted API wallet private key
- `hyperliquidWalletAddress` (`String`, default `""`) — master wallet address for balance queries (API wallet address differs from master; Hyperliquid's `spotClearinghouseState` returns empty results for API wallet addresses)
- `hyperliquidKeyCreatedDate` (`DateTime?`, nullable) — when the API key was generated, used for expiry calculation

### 2. Encryption

Add a `lib/encryption.ts` module with `encrypt(plaintext, key)` and `decrypt(ciphertext, key)` using AES-256-GCM. The encryption key comes from a new `DB_ENCRYPTION_KEY` env var.

The private key is encrypted before DB writes and decrypted on read in `HyperliquidBot`.

### 3. Environment variables

**Remove:** `MNEMONIC`

**Add:** `DB_ENCRYPTION_KEY` — 32-byte hex key for AES-256-GCM

**Clean up `.env.example`:** remove `MNEMONIC`, add `DB_ENCRYPTION_KEY`, remove any other stale references.

### 4. Wallet creation (`lib/hyperliquid-bot.ts`)

Replace `mnemonicToAccount` with `privateKeyToAccount` from `viem/accounts`. The `ExchangeClient` accepts the same wallet interface.

`HyperliquidBot` constructor changes:
- Accept private key and wallet address as constructor params (read from DB by caller) instead of reading env vars directly
- Use `privateKeyToAccount(privateKey)` for the exchange client wallet
- Use the provided wallet address for `spotClearinghouseState` balance queries

### 5. Settings UI

Add a "Hyperliquid" section to the settings page with:
- Private key input (password-masked)
- Wallet address input
- Key created date picker
- Show days remaining until expiry

### 6. Expiry warning

Before each DCA execution in `lib/strategy.ts`, check the key age. If within 7 days of the 180-day expiry, send a warning via `sendNotification`. The bot continues trading.

The check: `daysRemaining = 180 - daysSince(keyCreatedDate)`. If `daysRemaining <= 7`, warn.

### 7. Files affected

- `prisma/schema.prisma` — new AppConfiguration fields
- `lib/encryption.ts` — new encrypt/decrypt module
- `lib/hyperliquid-bot.ts` — constructor params, `privateKeyToAccount`
- `lib/hyperliquid-bot.test.ts` — update tests
- `lib/strategy.ts` — add expiry check, pass DB config to bot
- `lib/app-config.ts` — include new fields in config resolution
- `app/` — settings UI page and API routes for the new fields
- `.env.example` — remove MNEMONIC, add DB_ENCRYPTION_KEY
- `instrumentation.ts` — remove MNEMONIC reference
- `lib/integration.test.ts` — update env/mock references
- `README.md` — update setup instructions
- `docs/SECURITY.md` — update key handling docs
- `ARCHITECTURE.md` — update references
- `.github/workflows/deploy.yml` — replace MNEMONIC secret with DB_ENCRYPTION_KEY

### 8. Testing

- Unit test: encryption round-trip (encrypt then decrypt returns original)
- Unit test: expiry check logic (no warning at 174+ days remaining, warning at 7 days, warning at 0 days)
- Unit test: `HyperliquidBot` uses `privateKeyToAccount` with provided key
- Unit test: balance queries use wallet address, not derived API key address
- Integration test: missing DB_ENCRYPTION_KEY throws
- Integration test: missing private key in DB is handled gracefully
