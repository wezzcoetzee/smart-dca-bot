import { Registry, Gauge, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({ app: 'smart-dca-bot' });
collectDefaultMetrics({ register: metricsRegistry });

export const botRunning = new Gauge({
    name: 'bot_runtime_up',
    help: 'Whether the bot runtime is currently active (1=running, 0=stopped)',
    registers: [metricsRegistry],
});

export const dcaExecutionTotal = new Counter({
    name: 'dca_execution_total',
    help: 'Total DCA executions by status',
    labelNames: ['status'] as const,
    registers: [metricsRegistry],
});

export const dcaExecutionDuration = new Histogram({
    name: 'dca_execution_duration_seconds',
    help: 'Duration of DCA strategy execution in seconds',
    buckets: [1, 5, 10, 30, 60, 120],
    registers: [metricsRegistry],
});

export const dcaPurchaseAmountUsd = new Gauge({
    name: 'dca_purchase_amount_usd',
    help: 'USD amount of the last DCA purchase',
    registers: [metricsRegistry],
});

export const dcaBtcPriceUsd = new Gauge({
    name: 'dca_btc_price_usd',
    help: 'Current BTC price in USD at time of execution',
    registers: [metricsRegistry],
});

export const dcaMultiplierTriggered = new Gauge({
    name: 'dca_multiplier_triggered',
    help: 'Multiplier value triggered (0 if none)',
    labelNames: ['reason'] as const,
    registers: [metricsRegistry],
});

export const dcaTokensPurchased = new Gauge({
    name: 'dca_tokens_purchased',
    help: 'Number of tokens purchased in last execution',
    registers: [metricsRegistry],
});

export const dcaSwapRetryTotal = new Counter({
    name: 'dca_swap_retry_total',
    help: 'Total number of swap retries',
    registers: [metricsRegistry],
});

export const dcaWalletBalance = new Gauge({
    name: 'dca_wallet_balance',
    help: 'Wallet balance by token',
    labelNames: ['token'] as const,
    registers: [metricsRegistry],
});

export const hyperliquidOrderDuration = new Histogram({
    name: 'hyperliquid_order_duration_seconds',
    help: 'Duration of Hyperliquid spot order execution in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30],
    registers: [metricsRegistry],
});

export const discordNotificationTotal = new Counter({
    name: 'discord_notification_total',
    help: 'Total Discord notifications by status',
    labelNames: ['status'] as const,
    registers: [metricsRegistry],
});

