# Security

## Authentication

### `/api/cron` Route

The bot execution endpoint is protected by a bearer token check implemented in `app/api/cron/route.ts`:

```ts
const authHeader = request.headers.get("authorization");

if (appConfig.cronSecret && authHeader !== `Bearer ${appConfig.cronSecret}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Key behaviors:

- The secret is read from `AppConfig.cronSecret` — the `AppConfiguration` database row, set via `/settings/schedule`. There is no environment-variable fallback for this value.
- If `cronSecret` is an empty string (unset), the check is skipped and the endpoint accepts all requests. Always set a cron secret in production.
- The cron container sends the secret as `Authorization: Bearer <CRON_SECRET>` on every scheduled execution, where its `CRON_SECRET` env var must match the value stored in the database.
- `/api/deploy-notify` is protected by the same `cronSecret` bearer check.

### Other Endpoints

`/api/dashboard`, `/api/multiplier-configuration`, `/api/app-configuration`, and all other API routes have no authentication. This is intentional — the application is a single-user tool designed to run on a private network or behind a reverse proxy. Do not expose these routes to the public internet without adding authentication at the proxy layer.

---

## Wallet Key Management

The Hyperliquid API wallet private key is stored encrypted in the database using AES-256-GCM. It is configured via the Settings UI at `/settings/hyperliquid` and never returned to the frontend — the API masks it as `"••••••••"`. The wallet address and key creation date are stored alongside it; keys expire after 180 days, with a 7-day warning sent via the configured notification channel.

Encryption and decryption use `DB_ENCRYPTION_KEY`, a 32-byte hex value that must be set as an environment variable. At trade execution time the key is decrypted in memory and passed to `privateKeyToAccount` (viem) to construct the signer passed to `ExchangeClient`.

---

## Sensitive Key Sanitization in Logs

`lib/logger.ts` sanitizes log context before writing. Any context key whose name contains `privateKey`, `password`, `token`, or `secret` (case-insensitive) is replaced with `[REDACTED]`:

```ts
const sensitiveKeys = ["privateKey", "password", "token", "secret"];

for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
    }
}
```

This applies to all structured log context objects passed to `logger.info()`, `logger.warn()`, `logger.error()`, and `logger.debug()`. It does not sanitize free-form message strings — avoid interpolating secrets into message strings directly.

Log output format:

```
2024-01-15T00:00:00.000Z [INFO ] [smart-dca-bot] [strategy] Starting DCA strategy execution
```

The `symbol` field in the logger context (e.g., `"strategy"`, `"hyperliquid-bot"`, `"cron"`) is written as a bracketed tag, not as a structured key, so it does not go through sanitization. Do not pass secrets as the `symbol` context value.

---

## Secrets Checklist

| Secret | Storage | Notes |
|--------|---------|-------|
| `DB_ENCRYPTION_KEY` | ENV only | AES-256-GCM key for encrypting the API private key at rest |
| Hyperliquid private key | DB (encrypted) | Encrypted with `DB_ENCRYPTION_KEY`; masked as `"••••••••"` in API responses |
| Cron secret | DB (`AppConfiguration.cronSecret`) | Used for `/api/cron` bearer auth; cron container's `CRON_SECRET` env must match |
| Discord webhook URL | DB (`AppConfiguration.discordWebhookUrl`) | Masked as `"••••••••"` in API responses |
| `DATABASE_URL` | ENV only | Contains DB credentials |

All secrets should be injected at container runtime via environment variables, not baked into images.
