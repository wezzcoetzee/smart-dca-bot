import { DCAType } from "@/generated/prisma/enums";
import { getAppConfig, type AppConfig } from "./app-config";
import { checkConfigurationStalenessAsync, StalenessResult } from "./configuration-staleness";
import prisma from "./db";
import { decrypt } from "./encryption";
import { getCurrentPrice, getHistoricalPrices, calculateSMA } from "./hyperliquid";
import { HyperliquidBot, TransactionSentError, InsufficientBalanceError, TARGET_TOKEN_DISPLAY, type SpotBalances } from "./hyperliquid-bot";
import { shouldWarnExpiry, getDaysUntilExpiry } from "./key-expiry";
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

    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error("DB_ENCRYPTION_KEY not configured");
    }

    const privateKey = decrypt(appConfig.hyperliquidPrivateKey, encryptionKey);
    const bot = new HyperliquidBot(privateKey, appConfig.hyperliquidWalletAddress);

    if (appConfig.hyperliquidKeyCreatedDate) {
        if (shouldWarnExpiry(appConfig.hyperliquidKeyCreatedDate)) {
            const daysLeft = getDaysUntilExpiry(appConfig.hyperliquidKeyCreatedDate);
            const msg = daysLeft <= 0
                ? `Hyperliquid API key has expired. Generate a new key at https://app.hyperliquid.xyz/API`
                : `Hyperliquid API key expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Generate a new key at https://app.hyperliquid.xyz/API`;
            logger.warn(msg);
            await sendNotification(`⚠️ ${msg}`);
        }
    }

    const btcPrice = await getCurrentPrice(appConfig.hyperliquidSymbol);

    dcaBtcPriceUsd.set(btcPrice);
    logger.info(`Current ${appConfig.hyperliquidSymbol} price: $${btcPrice.toLocaleString()}`);

    return { appConfig, bot, btcPrice };
}

async function executeAndRecordTransaction(context: StrategyContext, availableUsdc: number): Promise<TransactionResult> {
    const { appConfig, bot, btcPrice } = context;

    logger.info(`Base purchase amount: $${appConfig.baseAmountToPurchase}`);

    const result = await executeBuyWithRetry(
        appConfig.baseAmountToPurchase,
        btcPrice,
        appConfig.hyperliquidSymbol,
        bot,
        availableUsdc,
    );

    logger.info(`Trade executed`, { filledQty: result.filledQty, reason: result.reason });

    dcaTokensPurchased.set(result.filledQty);

    await saveTransactionAsync(result.filledQty, btcPrice, result.reason, DCAType.PROGRAMATIC);
    await saveTransactionAsync(appConfig.baseAmountToPurchase / btcPrice, btcPrice, "Normal DCA", DCAType.FIXED);

    return result;
}

async function checkBalancesAndAlert(context: StrategyContext): Promise<SpotBalances> {
    const { appConfig, bot } = context;

    const balances = await bot.getBalances();

    dcaWalletBalance.labels("USDC").set(balances.usdc);
    dcaWalletBalance.labels(TARGET_TOKEN_DISPLAY).set(balances.btc);

    logger.info(`Balances`, {
        [TARGET_TOKEN_DISPLAY]: balances.btc.toFixed(8),
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

        const transactionResult = await executeAndRecordTransaction(context, preBalances.usdc);
        const balances = await checkBalancesAndAlert(context);

        const [staleness, totalUsdcSpent] = await Promise.all([
            checkConfigurationStalenessAsync(context.appConfig),
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
            targetTokenSymbol: TARGET_TOKEN_DISPLAY,
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

function isNonRetryableBuyError(error: unknown): boolean {
    if (InsufficientBalanceError && error instanceof InsufficientBalanceError) {
        return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Insufficient spot balance");
}

async function executeBuyWithRetry(
    baseAmountToPurchase: number,
    btcPrice: number,
    hyperliquidSymbol: string,
    bot: HyperliquidBot,
    availableUsdc: number,
    retryCount = 0,
): Promise<TransactionResult> {
    const maxRetries = 3;

    try {
        const { amount: amountToBuy, reason } = await determineAmountToBuyAsync(baseAmountToPurchase, btcPrice, hyperliquidSymbol);
        dcaPurchaseAmountUsd.set(amountToBuy);

        logger.info(`Executing spot buy: $${amountToBuy} -> BTC`);
        const result = await bot.buy(amountToBuy, btcPrice, availableUsdc);

        return { amount: amountToBuy, filledQty: result.filledQty, avgPrice: result.avgPrice, orderId: result.orderId, reason };
    } catch (error) {
        if (TransactionSentError && error instanceof TransactionSentError) {
            await sendNotification(`🚨 Order may have been sent — check Hyperliquid manually: ${error.message}`);
            throw error;
        }
        if (isNonRetryableBuyError(error)) {
            logger.error(`Buy aborted (non-retryable): ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
        if (retryCount < maxRetries) {
            const nextRetry = retryCount + 1;
            dcaSwapRetryTotal.inc();
            logger.warn(`Retry ${nextRetry}/${maxRetries}: ${error instanceof Error ? error.message : String(error)}`);
            return await executeBuyWithRetry(baseAmountToPurchase, btcPrice, hyperliquidSymbol, bot, availableUsdc, nextRetry);
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
    const rows = await prisma.$queryRaw<{ total: number | null }[]>`
        SELECT COALESCE(SUM(amount * price), 0)::float8 AS total
        FROM transactions
        WHERE dca_type = 'PROGRAMATIC'
    `;
    return rows[0]?.total ?? 0;
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
