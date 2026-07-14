# Hyperliquid Spot BTC DCA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Solana/Jupiter swap layer with Hyperliquid spot trading for native BTC DCA.

**Architecture:** New `HyperliquidBot` class replaces `SolanaBot`. Uses `@nktkas/hyperliquid` SDK with `viem` for EVM wallet derivation from the existing mnemonic. Strategy orchestration stays the same with minimal interface changes. Prisma schema drops Solana-specific columns, adds `lowBalanceThreshold`.

**Tech Stack:** `@nktkas/hyperliquid`, `viem`, Prisma 7, Next.js 16, Bun

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/hyperliquid-bot.ts` | Create | Spot buy, balance queries, low-balance check |
| `lib/hyperliquid-bot.test.ts` | Create | Tests for HyperliquidBot |
| `lib/strategy.ts` | Modify | Replace SolanaBot with HyperliquidBot |
| `lib/strategy.test.ts` | Modify | Update mocks from SolanaBot → HyperliquidBot |
| `lib/app-config.ts` | Modify | Update AppConfig interface |
| `lib/config.ts` | Modify | Remove Solana block explorer URLs |
| `lib/metrics.ts` | Modify | Replace Solana/Jupiter metrics with Hyperliquid metrics |
| `lib/solana-bot.ts` | Delete | No longer needed |
| `lib/solana-bot.test.ts` | Delete | No longer needed |
| `lib/solana.ts` | Delete | No longer needed |
| `lib/solana.test.ts` | Delete | No longer needed |
| `prisma/schema.prisma` | Modify | Drop Solana columns, add lowBalanceThreshold |
| `app/settings/layout.tsx` | Modify | Rename "Solana" nav → "Trading", rename "Tokens" → "DCA" |
| `app/settings/solana/page.tsx` | Delete | Replaced by trading page |
| `app/settings/trading/page.tsx` | Create | Low balance threshold config |
| `app/settings/tokens/page.tsx` | Modify | Simplify to base amount + hyperliquid symbol only |
| `app/settings/_components/shared.tsx` | Modify | Update AppConfig interface |
| `app/api/wallet-balance/route.ts` | Modify | Query Hyperliquid spot balances |
| `app/api/token-metadata/route.ts` | Delete (if exists) | No longer needed |
| `package.json` | Modify | Swap dependencies |

---

### Task 1: Install Dependencies & Remove Solana Packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove Solana dependencies and add Hyperliquid + viem**

```bash
cd /Users/wesley/Development/smart-dca-bot
bun remove @jup-ag/api @solana/web3.js @solana/spl-token bip39 ed25519-hd-key bs58
bun add @nktkas/hyperliquid viem
```

- [ ] **Step 2: Verify install succeeds**

```bash
bun install
```

Expected: No errors, lockfile updated.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: swap Solana deps for @nktkas/hyperliquid and viem"
```

---

### Task 2: Create HyperliquidBot with Tests (TDD)

**Files:**
- Create: `lib/hyperliquid-bot.ts`
- Create: `lib/hyperliquid-bot.test.ts`

- [ ] **Step 1: Write failing test — wallet derivation from mnemonic**

```typescript
// lib/hyperliquid-bot.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("HyperliquidBot", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MNEMONIC =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createWallet", () => {
    test("derives consistent EVM address from mnemonic", async () => {
      // #given
      const { createWallet } = await import("./hyperliquid-bot");

      // #when
      const wallet1 = createWallet();
      const wallet2 = createWallet();

      // #then
      expect(wallet1.address).toBe(wallet2.address);
      expect(wallet1.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    test("throws when MNEMONIC is not set", async () => {
      // #given
      delete process.env.MNEMONIC;

      // #when / #then
      const { createWallet } = await import("./hyperliquid-bot");
      expect(() => createWallet()).toThrow("MNEMONIC not set");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test lib/hyperliquid-bot.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createWallet**

```typescript
// lib/hyperliquid-bot.ts
import { mnemonicToAccount } from "viem/accounts";
import { createLogger } from "./logger";

const logger = createLogger({ symbol: "hyperliquid-bot" });

export function createWallet() {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not set in environment");
  }
  return mnemonicToAccount(mnemonic);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test lib/hyperliquid-bot.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test — getBalances**

Add to the same test file:

```typescript
  describe("HyperliquidBot class", () => {
    test("getBalances returns USDC and BTC balances", async () => {
      // #given
      const { HyperliquidBot } = await import("./hyperliquid-bot");
      const bot = new HyperliquidBot();

      // #when
      const balances = await bot.getBalances();

      // #then
      expect(balances).toHaveProperty("usdc");
      expect(balances).toHaveProperty("btc");
      expect(typeof balances.usdc).toBe("number");
      expect(typeof balances.btc).toBe("number");
    });
  });
```

Note: This test will hit the real Hyperliquid API. For CI you'd mock, but for now the test validates the real integration. If the wallet has no funds, balances will be 0 — that's fine.

- [ ] **Step 6: Run test to verify it fails**

```bash
bun test lib/hyperliquid-bot.test.ts
```

Expected: FAIL — HyperliquidBot class not found.

- [ ] **Step 7: Implement HyperliquidBot class with getBalances**

Update `lib/hyperliquid-bot.ts`:

```typescript
import { mnemonicToAccount } from "viem/accounts";
import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { createLogger } from "./logger";

const logger = createLogger({ symbol: "hyperliquid-bot" });

export function createWallet() {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not set in environment");
  }
  return mnemonicToAccount(mnemonic);
}

export interface SpotBalances {
  usdc: number;
  btc: number;
}

export interface BuyResult {
  filledQty: number;
  avgPrice: number;
  orderId: number;
}

export class HyperliquidBot {
  private wallet;
  private exchange: ExchangeClient;
  private info: InfoClient;

  readonly address: string;

  constructor() {
    this.wallet = createWallet();
    this.address = this.wallet.address;

    const transport = new HttpTransport();
    this.exchange = new ExchangeClient({ wallet: this.wallet, transport });
    this.info = new InfoClient({ transport });

    logger.info(`Bot initialized with address ${this.address}`);
  }

  async getBalances(): Promise<SpotBalances> {
    const state = await this.info.spotClearinghouseState({ user: this.address });

    let usdc = 0;
    let btc = 0;

    for (const balance of state.balances) {
      if (balance.coin === "USDC") {
        usdc = parseFloat(balance.total);
      } else if (balance.coin === "BTC") {
        btc = parseFloat(balance.total);
      }
    }

    logger.debug(`Balances — USDC: ${usdc.toFixed(2)}, BTC: ${btc.toFixed(8)}`);
    return { usdc, btc };
  }

  isLowBalance(usdcBalance: number, threshold: number): boolean {
    return usdcBalance < threshold;
  }

  async buy(usdAmount: number, currentPrice: number): Promise<BuyResult> {
    const spotMeta = await this.info.spotMeta();

    const btcUniverse = spotMeta.universe.find(
      (pair) => pair.name === "BTC/USDC"
    );
    if (!btcUniverse) {
      throw new Error("BTC/USDC spot pair not found on Hyperliquid");
    }

    const spotAssetIndex = 10000 + btcUniverse.index;
    const size = usdAmount / currentPrice;

    const btcToken = spotMeta.tokens.find((t) => t.name === "BTC");
    const szDecimals = btcToken?.szDecimals ?? 5;
    const roundedSize = parseFloat(size.toFixed(szDecimals));

    if (roundedSize <= 0) {
      throw new Error(`Order size too small: ${size} BTC (rounded to ${roundedSize})`);
    }

    const slippageMultiplier = 1.005;
    const limitPrice = (currentPrice * slippageMultiplier).toFixed(2);

    logger.info(`Placing spot buy: ${roundedSize} BTC @ limit $${limitPrice} (IOC)`);

    const result = await this.exchange.order({
      orders: [
        {
          a: spotAssetIndex,
          b: true,
          p: limitPrice,
          s: roundedSize.toString(),
          r: false,
          t: { limit: { tif: "Ioc" } },
        },
      ],
      grouping: "na",
    });

    const status = result.response.data.statuses[0];

    if ("filled" in status) {
      const filled = status.filled;
      logger.info(`Order filled: ${filled.totalSz} BTC @ avg $${filled.avgPx}`);
      return {
        filledQty: parseFloat(filled.totalSz),
        avgPrice: parseFloat(filled.avgPx),
        orderId: filled.oid,
      };
    }

    if ("resting" in status) {
      logger.warn(`Order resting (unexpected for IOC): oid=${status.resting.oid}`);
      throw new Error(`Order did not fill immediately (oid: ${status.resting.oid})`);
    }

    if ("error" in status) {
      throw new Error(`Order rejected: ${status.error}`);
    }

    throw new Error(`Unexpected order status: ${JSON.stringify(status)}`);
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
bun test lib/hyperliquid-bot.test.ts
```

Expected: PASS (getBalances returns 0s for unfunded wallet, which satisfies the type check).

- [ ] **Step 9: Write test — isLowBalance**

Add to test file:

```typescript
  describe("isLowBalance", () => {
    test("returns true when USDC is below threshold", async () => {
      // #given
      const { HyperliquidBot } = await import("./hyperliquid-bot");
      const bot = new HyperliquidBot();

      // #when / #then
      expect(bot.isLowBalance(50, 100)).toBe(true);
    });

    test("returns false when USDC is above threshold", async () => {
      // #given
      const { HyperliquidBot } = await import("./hyperliquid-bot");
      const bot = new HyperliquidBot();

      // #when / #then
      expect(bot.isLowBalance(150, 100)).toBe(false);
    });

    test("returns false when USDC equals threshold", async () => {
      // #given
      const { HyperliquidBot } = await import("./hyperliquid-bot");
      const bot = new HyperliquidBot();

      // #when / #then
      expect(bot.isLowBalance(100, 100)).toBe(false);
    });
  });
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
bun test lib/hyperliquid-bot.test.ts
```

Expected: PASS (isLowBalance is already implemented above).

- [ ] **Step 11: Commit**

```bash
git add lib/hyperliquid-bot.ts lib/hyperliquid-bot.test.ts
git commit -m "feat: add HyperliquidBot with spot buy, balance queries, and low-balance check"
```

---

### Task 3: Update Prisma Schema & AppConfig

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/app-config.ts`
- Modify: `app/settings/_components/shared.tsx`

- [ ] **Step 1: Update Prisma schema — drop Solana columns, add lowBalanceThreshold**

Replace the `AppConfiguration` model in `prisma/schema.prisma` with:

```prisma
model AppConfiguration {
  id                   String   @id @default("default") @map("id")
  baseAmountToPurchase Float    @default(5) @map("base_amount_to_purchase")
  targetTokenSymbol    String   @default("BTC") @map("target_token_symbol")
  hyperliquidSymbol    String   @default("BTC") @map("hyperliquid_symbol")
  lowBalanceThreshold  Float    @default(100) @map("low_balance_threshold")
  cronSecret           String   @default("") @map("cron_secret")
  discordWebhookUrl    String   @default("") @map("discord_webhook_url")
  discordEnabled       Boolean  @default(true) @map("discord_enabled")
  configWarningWeeks   Int      @default(1) @map("config_warning_weeks")
  configDangerWeeks    Int      @default(2) @map("config_danger_weeks")
  updatedAt            DateTime @default(now()) @updatedAt @map("updated_at")

  @@map("app_configuration")
}
```

- [ ] **Step 2: Generate migration**

```bash
cd /Users/wesley/Development/smart-dca-bot
bunx prisma migrate dev --name remove-solana-add-low-balance-threshold
```

Expected: Migration created successfully. If there's existing data, Prisma may warn about dropped columns — that's expected.

- [ ] **Step 3: Generate Prisma client**

```bash
bunx prisma generate
```

Expected: Client generated.

- [ ] **Step 4: Update AppConfig interface in `lib/app-config.ts`**

Replace the `AppConfig` interface with:

```typescript
export interface AppConfig {
  baseAmountToPurchase: number;
  targetTokenSymbol: string;
  hyperliquidSymbol: string;
  lowBalanceThreshold: number;
  cronSecret: string;
  discordWebhookUrl: string;
  discordEnabled: boolean;
  configWarningWeeks: number;
  configDangerWeeks: number;
}
```

- [ ] **Step 5: Update AppConfig in `app/settings/_components/shared.tsx`**

Replace the `AppConfig` interface with:

```typescript
export interface AppConfig {
  baseAmountToPurchase: number;
  targetTokenSymbol: string;
  hyperliquidSymbol: string;
  lowBalanceThreshold: number;
  cronSecret: string;
  discordWebhookUrl: string;
  discordEnabled: boolean;
  configWarningWeeks: number;
  configDangerWeeks: number;
}
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/app-config.ts app/settings/_components/shared.tsx generated/
git commit -m "feat: update schema — drop Solana columns, add lowBalanceThreshold"
```

---

### Task 4: Update Strategy to Use HyperliquidBot

**Files:**
- Modify: `lib/strategy.ts`

- [ ] **Step 1: Replace SolanaBot imports and usage in strategy.ts**

Replace the full content of `lib/strategy.ts`. Key changes:
- Import `HyperliquidBot` instead of `SolanaBot`
- Remove `PublicKey` import from `@solana/web3.js`
- Remove `TransactionSentError` import
- `StrategyContext` holds `HyperliquidBot` instead of `SolanaBot`
- `TransactionResult` uses `filledQty`, `avgPrice`, `orderId` instead of `outAmount`, `swapTxSignature`
- `initializeStrategyContext` creates `HyperliquidBot` (no config args needed)
- `executeAndRecordTransaction` calls `bot.buy(amount, btcPrice)` and records `filledQty` directly
- `fetchWalletBalances` calls `bot.getBalances()` and checks low balance with `bot.isLowBalance()`
- Remove `fetchWalletBalances` dependency on Solana PublicKeys
- Notification message drops SOL gas balance, drops swap tx signature, adds Hyperliquid context
- Remove retry logic around `TransactionSentError` — replace with simpler retry: if the order fails (network error before order placed), retry. If order was placed (got a response), don't retry.

The full replacement for `lib/strategy.ts`:

```typescript
import { DCAType } from "@/generated/prisma/enums";
import { getAppConfig, type AppConfig } from "./app-config";
import { checkConfigurationStalenessAsync, StalenessResult } from "./configuration-staleness";
import prisma from "./db";
import { getCurrentPrice, getHistoricalPrices, calculateSMA } from "./hyperliquid";
import { HyperliquidBot, type SpotBalances, type BuyResult } from "./hyperliquid-bot";
import { createLogger } from "./logger";
import {
    dcaExecutionTotal,
    dcaExecutionDuration,
    dcaPurchaseAmountUsd,
    dcaBtcPriceUsd,
    dcaMultiplierTriggered,
    dcaTokensPurchased,
    dcaSwapRetryTotal,
    dcaWalletBalance,
} from "./metrics";
import { sendNotification } from "./notifications";

const logger = createLogger({ symbol: "strategy" });

interface StrategyContext {
    appConfig: AppConfig;
    bot: HyperliquidBot;
    btcPrice: number;
}

interface TransactionResult {
    amount: number;
    filledQty: number;
    avgPrice: number;
    orderId: number;
    reason: string;
}

async function initializeStrategyContext(): Promise<StrategyContext> {
    const appConfig = await getAppConfig();
    const bot = new HyperliquidBot();
    const btcPrice = await getCurrentPrice(appConfig.hyperliquidSymbol);

    dcaBtcPriceUsd.set(btcPrice);
    logger.info(`Current ${appConfig.hyperliquidSymbol} price: $${btcPrice.toLocaleString()}`);

    return { appConfig, bot, btcPrice };
}

async function executeAndRecordTransaction(context: StrategyContext): Promise<TransactionResult> {
    const { appConfig, bot, btcPrice } = context;

    logger.info(`Base purchase amount: $${appConfig.baseAmountToPurchase}`);

    const result = await executeBuyWithRetry(
        appConfig.baseAmountToPurchase,
        btcPrice,
        appConfig.hyperliquidSymbol,
        bot,
    );

    logger.info(`Trade executed`, { filledQty: result.filledQty, reason: result.reason });

    dcaTokensPurchased.set(result.filledQty);

    await saveTransactionAsync(result.filledQty, btcPrice, result.reason, DCAType.PROGRAMATIC);
    await saveTransactionAsync(appConfig.baseAmountToPurchase / btcPrice, btcPrice, "Normal DCA", DCAType.FIXED);

    return result;
}

async function checkBalancesAndAlert(context: StrategyContext, transactionResult: TransactionResult): Promise<SpotBalances> {
    const { appConfig, bot } = context;

    const balances = await bot.getBalances();

    dcaWalletBalance.labels("USDC").set(balances.usdc);
    dcaWalletBalance.labels(appConfig.targetTokenSymbol).set(balances.btc);

    logger.info(`Balances`, {
        [appConfig.targetTokenSymbol]: balances.btc.toFixed(8),
        USDC: balances.usdc.toFixed(2),
    });

    if (bot.isLowBalance(balances.usdc, appConfig.lowBalanceThreshold)) {
        const warning = `Low USDC balance: $${balances.usdc.toFixed(2)} (threshold: $${appConfig.lowBalanceThreshold})`;
        logger.warn(warning);
        await sendNotification(`\u26A0\uFE0F ${warning}\nDeposit USDC to continue DCA.`);
    }

    return balances;
}

export async function runStrategyAsync(): Promise<TransactionResult> {
    logger.info("Starting DCA strategy execution");
    const timer = dcaExecutionDuration.startTimer();

    try {
        const context = await initializeStrategyContext();

        const preBalances = await context.bot.getBalances();
        if (preBalances.usdc < context.appConfig.baseAmountToPurchase) {
            const msg = `Insufficient USDC: $${preBalances.usdc.toFixed(2)} available, $${context.appConfig.baseAmountToPurchase} needed`;
            logger.error(msg);
            await sendNotification(`\u{1F6D1} ${msg}`);
            throw new Error(msg);
        }

        const transactionResult = await executeAndRecordTransaction(context);
        const balances = await checkBalancesAndAlert(context, transactionResult);

        const [staleness, totalUsdcSpent] = await Promise.all([
            checkConfigurationStalenessAsync(),
            getTotalUsdcSpentAsync(),
        ]);

        if (staleness.alertLevel !== "none") {
            logger.warn(`Configuration staleness detected`, {
                alertLevel: staleness.alertLevel,
                staleCount: staleness.staleConfigs.length,
            });
        }

        await notifyAsync({
            filledQty: transactionResult.filledQty,
            usdAmountSpent: transactionResult.amount,
            btcBalance: balances.btc,
            walletValue: balances.btc * context.btcPrice,
            totalUsdcSpent,
            usdcBalance: balances.usdc,
            orderId: transactionResult.orderId,
            reason: transactionResult.reason,
            staleness,
            targetTokenSymbol: context.appConfig.targetTokenSymbol,
            currentPrice: context.btcPrice,
        });

        dcaExecutionTotal.labels("success").inc();
        logger.info("Strategy execution completed successfully");
        return transactionResult;
    } catch (error) {
        dcaExecutionTotal.labels("failure").inc();
        logger.error("DCA strategy execution failed", error instanceof Error ? error : new Error(String(error)));
        await notifyFailureAsync(error);
        throw error;
    } finally {
        timer();
    }
}

async function executeBuyWithRetry(
    baseAmountToPurchase: number,
    btcPrice: number,
    hyperliquidSymbol: string,
    bot: HyperliquidBot,
    retryCount = 0,
): Promise<TransactionResult> {
    const maxRetries = 3;

    try {
        const { amount: amountToBuy, reason } = await determineAmountToBuyAsync(baseAmountToPurchase, btcPrice, hyperliquidSymbol);
        dcaPurchaseAmountUsd.set(amountToBuy);

        logger.info(`Executing spot buy: $${amountToBuy} -> BTC`);
        const result = await bot.buy(amountToBuy, btcPrice);

        return { amount: amountToBuy, filledQty: result.filledQty, avgPrice: result.avgPrice, orderId: result.orderId, reason };
    } catch (error) {
        if (retryCount < maxRetries) {
            const nextRetry = retryCount + 1;
            dcaSwapRetryTotal.inc();
            logger.warn(`Retry ${nextRetry}/${maxRetries}: ${error instanceof Error ? error.message : String(error)}`);
            return await executeBuyWithRetry(baseAmountToPurchase, btcPrice, hyperliquidSymbol, bot, nextRetry);
        }
        logger.error(`Failed after ${maxRetries} retries`, error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

async function saveTransactionAsync(amountOfTokensBought: number, price: number, reason: string, dcaType: DCAType): Promise<void> {
    await prisma.transaction.create({
        data: {
            amount: amountOfTokensBought,
            price: price,
            reason: reason,
            dcaType: dcaType,
        },
    });

    logger.debug(`Saved ${dcaType} transaction: ${amountOfTokensBought.toFixed(8)} tokens @ $${price.toLocaleString()} (${reason})`);
}

async function getTotalUsdcSpentAsync(): Promise<number> {
    const transactions = await prisma.transaction.findMany({
        where: { dcaType: DCAType.PROGRAMATIC },
        select: { amount: true, price: true },
    });

    return transactions.reduce((sum, tx) => sum + tx.amount * tx.price, 0);
}

interface NotificationData {
    filledQty: number;
    usdAmountSpent: number;
    btcBalance: number;
    walletValue: number;
    totalUsdcSpent: number;
    usdcBalance: number;
    orderId: number;
    reason: string;
    staleness: StalenessResult;
    targetTokenSymbol: string;
    currentPrice: number;
}

async function notifyAsync(data: NotificationData): Promise<void> {
    let message = `*Trade Executed*

${data.filledQty.toFixed(8)} ${data.targetTokenSymbol} ($${data.usdAmountSpent.toFixed(2)})
${data.reason}

*Wallet (Hyperliquid)*
${data.btcBalance.toFixed(8)} ${data.targetTokenSymbol} ($${data.walletValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})
Total Spent: $${data.totalUsdcSpent.toLocaleString(undefined, { maximumFractionDigits: 2 })}

Price: $${data.currentPrice.toLocaleString()} | USDC: ${data.usdcBalance.toFixed(2)}
`;

    if (data.staleness.alertLevel !== "none") {
        const emoji = data.staleness.alertLevel === "danger" ? "\u{1F6A8}" : "\u{26A0}\u{FE0F}";
        const label = data.staleness.alertLevel === "danger" ? "Configuration Alert" : "Configuration Warning";
        const staleList = data.staleness.staleConfigs
            .map(c => `\u{2022} ${c.label} (${c.weeksStale} week${c.weeksStale === 1 ? "" : "s"} stale)`)
            .join("\n");

        message += `

${emoji} *${label}*
The following configurations haven't been updated recently:
${staleList}`;
    }

    logger.info("Sending notifications");
    await sendNotification(message);
    logger.info("Notifications sent");
}

async function notifyFailureAsync(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const timestamp = new Date().toISOString();

    const message = `*Trade Failed*

${errorMessage}
${timestamp}`;

    logger.info("Sending failure notifications");
    try {
        await sendNotification(message);
        logger.info("Failure notifications sent");
    } catch (notifyError) {
        logger.error("Failed to send failure notification", notifyError instanceof Error ? notifyError : new Error(String(notifyError)));
    }
}

export async function determineAmountToBuyAsync(baseAmountToPurchase: number, btcPrice: number, hyperliquidSymbol: string): Promise<{ amount: number, reason: string }> {
    const allMultipliers = await prisma.multiplierConfiguration.findMany();
    const multipliers = allMultipliers.filter(m => m.enabled);
    logger.info(`Evaluating ${multipliers.length}/${allMultipliers.length} enabled multiplier conditions`);

    const lthPriceMultiplier = multipliers.find(multiplier => multiplier.type === "LTH_REALIZED_PRICE");
    if (lthPriceMultiplier) {
        const lthPrice = Number(lthPriceMultiplier.value);
        if (lthPrice >= btcPrice) {
            logger.info(`LTH_REALIZED_PRICE triggered: $${lthPrice.toLocaleString()} <= $${btcPrice.toLocaleString()} (${lthPriceMultiplier.multiplier}x)`);
            dcaMultiplierTriggered.labels("Below LTH Realized Price").set(lthPriceMultiplier.multiplier);
            return { amount: baseAmountToPurchase * lthPriceMultiplier.multiplier, reason: "Below LTH Realized Price" };
        }
        logger.debug(`LTH_REALIZED_PRICE not met: $${lthPrice.toLocaleString()} > $${btcPrice.toLocaleString()}`);
    }

    const lthBuyingMultiplier = multipliers.find(multiplier => multiplier.type === "LTH_BUYING");
    if (lthBuyingMultiplier) {
        const isLthBuying = lthBuyingMultiplier.value === "true";
        if (isLthBuying) {
            logger.info(`LTH_BUYING triggered (${lthBuyingMultiplier.multiplier}x)`);
            dcaMultiplierTriggered.labels("LTH Buying").set(lthBuyingMultiplier.multiplier);
            return { amount: baseAmountToPurchase * lthBuyingMultiplier.multiplier, reason: "LTH Buying" };
        }
        logger.debug(`LTH_BUYING not met: value=${lthBuyingMultiplier.value}`);
    }

    const averagePriceMultiplier = multipliers.find(multiplier => multiplier.type === "AVERAGE_REALIZED_PRICE");
    if (averagePriceMultiplier) {
        const avgPrice = Number(averagePriceMultiplier.value);
        if (avgPrice >= btcPrice) {
            logger.info(`AVERAGE_REALIZED_PRICE triggered: $${avgPrice.toLocaleString()} <= $${btcPrice.toLocaleString()} (${averagePriceMultiplier.multiplier}x)`);
            dcaMultiplierTriggered.labels("Below Average Realized Price").set(averagePriceMultiplier.multiplier);
            return { amount: baseAmountToPurchase * averagePriceMultiplier.multiplier, reason: "Below Average Realized Price" };
        }
        logger.debug(`AVERAGE_REALIZED_PRICE not met: $${avgPrice.toLocaleString()} > $${btcPrice.toLocaleString()}`);
    }

    const movingAverageMultiplier = multipliers.find(multiplier => multiplier.type === "MOVING_AVERAGE");
    if (movingAverageMultiplier) {
        const days = Number(movingAverageMultiplier.value);
        if (isNaN(days) || days <= 0) {
            logger.warn(`MOVING_AVERAGE skipped: invalid days value "${movingAverageMultiplier.value}"`);
        } else {
            logger.debug(`Calculating ${days}-day moving average`);
            const movingAverage = await getMovingAverageAsync(days, hyperliquidSymbol);
            if (movingAverage >= btcPrice) {
                logger.info(`MOVING_AVERAGE triggered: ${days}d MA $${movingAverage.toLocaleString()} <= $${btcPrice.toLocaleString()} (${movingAverageMultiplier.multiplier}x)`);
                dcaMultiplierTriggered.labels("Below Moving Average").set(movingAverageMultiplier.multiplier);
                return { amount: baseAmountToPurchase * movingAverageMultiplier.multiplier, reason: "Below Moving Average" };
            }
            logger.debug(`MOVING_AVERAGE not met: ${days}d MA $${movingAverage.toLocaleString()} > $${btcPrice.toLocaleString()}`);
        }
    }

    logger.info(`No conditions met - using base amount $${baseAmountToPurchase}`);
    dcaMultiplierTriggered.labels("none").set(0);
    return { amount: baseAmountToPurchase, reason: "No multiplier conditions met" };
}

async function getMovingAverageAsync(days: number, hyperliquidSymbol: string): Promise<number> {
    const historicalPrices = await getHistoricalPrices(hyperliquidSymbol, days);
    logger.debug(`Fetched ${historicalPrices.length} price points for ${days}-day calculation`);
    return calculateSMA(historicalPrices);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/strategy.ts
git commit -m "feat: replace SolanaBot with HyperliquidBot in strategy"
```

---

### Task 5: Update Strategy Tests

**Files:**
- Modify: `lib/strategy.test.ts`

- [ ] **Step 1: Update strategy test mocks**

Replace all `mock.module("./solana-bot", ...)` blocks with `mock.module("./hyperliquid-bot", ...)` throughout the file.

Remove all `@solana/web3.js` imports and `Keypair` usage.

Remove Solana-specific env vars from `beforeEach`.

For `runStrategyAsync` tests, replace the `mockAppConfig` with:

```typescript
    const mockAppConfig = {
      baseAmountToPurchase: 10,
      targetTokenSymbol: "BTC",
      hyperliquidSymbol: "BTC",
      lowBalanceThreshold: 100,
      cronSecret: "test-secret",
      discordWebhookUrl: "",
      discordEnabled: false,
      configWarningWeeks: 1,
      configDangerWeeks: 2,
    };
```

Replace every `mock.module("./solana-bot", ...)` with:

```typescript
      mock.module("./hyperliquid-bot", () => ({
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() =>
            Promise.resolve({ usdc: 1000, btc: 0.5 })
          );
          isLowBalance = mock(() => false);
          buy = mock(() =>
            Promise.resolve({
              filledQty: 0.0002,
              avgPrice: 50000,
              orderId: 12345,
            })
          );
        },
      }));
```

Update assertions to use the new field names:
- `result.outAmount` → `result.filledQty`
- `result.swapTxSignature` → `result.orderId`

For the "retries failed transactions" test, update retry count expectation from 6 to 4 (1 initial + 3 retries).

For the "does not retry when TransactionSentError" test — remove it. There's no `TransactionSentError` concept anymore. All failures are retried up to `maxRetries`.

For the "saves both PROGRAMATIC and FIXED transaction types" test, update the PROGRAMATIC amount assertion: the filled quantity comes from `filledQty` (0.0002) not from `outAmount / decimals`.

- [ ] **Step 2: Run strategy tests**

```bash
bun test lib/strategy.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/strategy.test.ts
git commit -m "test: update strategy tests for HyperliquidBot"
```

---

### Task 6: Update Metrics

**Files:**
- Modify: `lib/metrics.ts`

- [ ] **Step 1: Replace Solana/Jupiter metrics with Hyperliquid metrics**

Remove these metrics from `lib/metrics.ts`:
- `jupiterRequestDuration` (Histogram)
- `solanaTxConfirmationDuration` (Histogram)

Add:

```typescript
export const hyperliquidOrderDuration = new Histogram({
    name: 'hyperliquid_order_duration_seconds',
    help: 'Duration of Hyperliquid spot order execution in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30],
    registers: [metricsRegistry],
});
```

- [ ] **Step 2: Update config.ts — remove block explorer URLs**

Replace `lib/config.ts` with an empty export or remove the file. Check if anything else imports it first.

```bash
grep -r "from.*./config" lib/ app/
```

If only `solana-bot.ts` imports it, delete `lib/config.ts`. Otherwise, keep the file but remove the Solana-specific URLs.

- [ ] **Step 3: Commit**

```bash
git add lib/metrics.ts lib/config.ts
git commit -m "chore: replace Solana/Jupiter metrics with Hyperliquid metrics"
```

---

### Task 7: Delete Solana Files

**Files:**
- Delete: `lib/solana-bot.ts`
- Delete: `lib/solana-bot.test.ts`
- Delete: `lib/solana.ts`
- Delete: `lib/solana.test.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "solana-bot\|from.*./solana" lib/ app/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (all references were updated in prior tasks). If matches remain, update them first.

- [ ] **Step 2: Delete files**

```bash
rm lib/solana-bot.ts lib/solana-bot.test.ts lib/solana.ts lib/solana.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A lib/solana-bot.ts lib/solana-bot.test.ts lib/solana.ts lib/solana.test.ts
git commit -m "chore: remove Solana integration files"
```

---

### Task 8: Update Wallet Balance API Route

**Files:**
- Modify: `app/api/wallet-balance/route.ts`

- [ ] **Step 1: Rewrite wallet-balance route to use HyperliquidBot**

Replace the full content of `app/api/wallet-balance/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { HyperliquidBot } from "@/lib/hyperliquid-bot";

const logger = createLogger({ symbol: "wallet" });

export async function GET() {
  try {
    const bot = new HyperliquidBot();
    const balances = await bot.getBalances();

    return NextResponse.json({
      walletAddress: bot.address,
      balances: {
        btc: {
          amount: balances.btc,
        },
        usdc: {
          amount: balances.usdc,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to fetch balances", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Check for any frontend code consuming the old response shape**

```bash
grep -r "balances\.cbbtc\|balances\.sol\|rawAmount\|walletAddress" app/ --include="*.ts" --include="*.tsx"
```

Update any consumers to use the new simpler shape (`balances.btc.amount`, `balances.usdc.amount`). No more `cbbtc`, `sol`, or `rawAmount` fields.

- [ ] **Step 3: Commit**

```bash
git add app/api/wallet-balance/route.ts
git commit -m "feat: update wallet-balance API to use Hyperliquid spot balances"
```

---

### Task 9: Update Settings UI

**Files:**
- Modify: `app/settings/layout.tsx`
- Delete: `app/settings/solana/page.tsx`
- Create: `app/settings/trading/page.tsx`
- Modify: `app/settings/tokens/page.tsx`

- [ ] **Step 1: Update settings nav in layout.tsx**

Replace the `NAV_ITEMS` array in `app/settings/layout.tsx`:

```typescript
const NAV_ITEMS = [
  { label: "Multiplier Settings", href: "/settings/multiplier-settings" },
  { label: "Trading", href: "/settings/trading" },
  { label: "DCA", href: "/settings/dca" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Schedule", href: "/settings/schedule" },
  { label: "Staleness Alerts", href: "/settings/staleness" },
];
```

- [ ] **Step 2: Delete Solana settings page**

```bash
rm -rf app/settings/solana
```

- [ ] **Step 3: Create Trading settings page**

Create `app/settings/trading/page.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";

export default function TradingPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/app-configuration");
        if (!response.ok) throw new Error("Failed to fetch configuration");
        const result = await response.json();
        if (result.success) {
          setConfig(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleChange = (name: keyof AppConfig, value: string | number) => {
    if (!config) return;
    setConfig({ ...config, [name]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const response = await fetch("/api/app-configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save configuration");

      toast.success("Trading configuration saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-[#666666] text-[14px] tracking-[-0.01em]">Loading...</div>;
  }

  if (!config) {
    return <div className="text-[#DC2626] text-[14px] tracking-[-0.01em]">Failed to load configuration</div>;
  }

  return (
    <div>
      <h2 className="text-[18px] font-normal text-white tracking-[-0.01em] mb-8">
        Trading Configuration
      </h2>

      <div className="space-y-8">
        <ConfigField
          label="Low Balance Threshold"
          name="lowBalanceThreshold"
          value={config.lowBalanceThreshold}
          onChange={handleChange}
          type="number"
          description="USDC balance below this amount triggers a Discord warning"
        />
      </div>

      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
```

- [ ] **Step 4: Simplify tokens page → rename to DCA page**

Move and simplify the tokens page:

```bash
mv app/settings/tokens app/settings/dca
```

Replace `app/settings/dca/page.tsx` with:

```typescript
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";

export default function DCAPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/app-configuration");
        if (!response.ok) throw new Error("Failed to fetch configuration");
        const result = await response.json();
        if (result.success) {
          setConfig(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleChange = (name: keyof AppConfig, value: string | number) => {
    if (!config) return;
    setConfig({ ...config, [name]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const response = await fetch("/api/app-configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save configuration");

      toast.success("DCA configuration saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-[#666666] text-[14px] tracking-[-0.01em]">Loading...</div>;
  }

  if (!config) {
    return <div className="text-[#DC2626] text-[14px] tracking-[-0.01em]">Failed to load configuration</div>;
  }

  return (
    <div>
      <h2 className="text-[18px] font-normal text-white tracking-[-0.01em] mb-8">
        DCA Configuration
      </h2>

      <div className="space-y-8">
        <ConfigField
          label="Base Purchase Amount"
          name="baseAmountToPurchase"
          value={config.baseAmountToPurchase}
          onChange={handleChange}
          type="number"
          description="Base USD amount per purchase (before multipliers)"
        />
        <ConfigField
          label="Target Token Symbol"
          name="targetTokenSymbol"
          value={config.targetTokenSymbol}
          onChange={handleChange}
          placeholder="BTC"
          description="Symbol for the token you're buying"
        />
        <ConfigField
          label="Hyperliquid Symbol"
          name="hyperliquidSymbol"
          value={config.hyperliquidSymbol}
          onChange={handleChange}
          placeholder="BTC"
          description="Symbol for price data from Hyperliquid"
        />
      </div>

      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
```

- [ ] **Step 5: Delete token-metadata API route if it exists**

```bash
ls app/api/token-metadata/
```

If it exists, delete it — it was Solana-specific.

```bash
rm -rf app/api/token-metadata
```

- [ ] **Step 6: Commit**

```bash
git add app/settings/ app/api/token-metadata/
git commit -m "feat: update settings UI — replace Solana config with Hyperliquid trading config"
```

---

### Task 10: Update Dashboard Balance Display

**Files:**
- Components consuming wallet balance API (find and update)

- [ ] **Step 1: Find dashboard balance consumers**

```bash
grep -r "wallet-balance\|walletBalance\|gasToken\|cbbtc\|sellToken" app/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Update any component that displays SOL/cbbtc/sell token balances**

Update to use the new simpler response shape:
- Remove SOL balance display
- `cbbtc` → `btc`
- Remove `rawAmount`, `decimals`, `tokenAddress` references
- Show just USDC and BTC balances from Hyperliquid

- [ ] **Step 3: Verify the app builds**

```bash
bun run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: update dashboard to display Hyperliquid spot balances"
```

---

### Task 11: Update app-configuration API Route

**Files:**
- Modify: `app/api/app-configuration/route.ts` (if it needs changes for new fields)

- [ ] **Step 1: Check the app-configuration API route**

```bash
cat app/api/app-configuration/route.ts
```

Verify it uses the generic `getAppConfig()` / `updateAppConfig()` which are already updated. If it references any removed fields, update accordingly.

- [ ] **Step 2: Update the Prisma seed file if it exists**

```bash
cat prisma/seed.ts
```

Update the seed data to remove Solana fields and add `lowBalanceThreshold: 100`.

- [ ] **Step 3: Commit if changes were made**

```bash
git add app/api/app-configuration/ prisma/seed.ts
git commit -m "chore: update app-configuration API and seed for new schema"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run all tests**

```bash
bun test
```

Expected: All tests pass.

- [ ] **Step 2: Run linter**

```bash
bun run lint
```

Expected: No errors.

- [ ] **Step 3: Build the app**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Verify no remaining Solana references**

```bash
grep -r "solana\|jupiter\|@solana\|@jup-ag\|bip39\|ed25519-hd-key\|LAMPORTS\|PublicKey.*web3" lib/ app/ --include="*.ts" --include="*.tsx" -i
```

Expected: No matches (except possibly in git history or node_modules).

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: final cleanup — remove all Solana references"
```
