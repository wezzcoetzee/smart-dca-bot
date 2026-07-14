# Product Specs

Feature specifications for the smart-dca-bot UI.

## Pages

### [Dashboard](./dashboard.md)

The main view at `/`. Displays a live BTC price feed, a period-selectable dual DCA performance chart, and a transaction history table. Shows how the programmatic strategy compares to a fixed-amount DCA strategy over the selected period.

### [Settings](./settings.md)

The configuration UI at `/settings`. Seven sub-pages covering multiplier thresholds, trading (low-balance threshold), DCA (base amount, price symbol), Discord notifications, cron schedule authentication, Hyperliquid API credentials, and staleness alert thresholds. All settings persist to the database via `AppConfiguration` and `MultiplierConfiguration` models.
