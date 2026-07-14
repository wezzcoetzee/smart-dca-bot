import { privateKeyToAccount } from "viem/accounts";
import { ExchangeClient, HttpRequestError, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { createLogger } from "./logger";

export class TransactionSentError extends Error {
  constructor(public readonly details: unknown) {
    super("Order sent but outcome is ambiguous — manual verification required");
    this.name = "TransactionSentError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

const logger = createLogger({ symbol: "hyperliquid-bot" });

export const TARGET_TOKEN = "UBTC";
export const TARGET_TOKEN_DISPLAY = "BTC";

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
  readonly address: string;
  private exchange: ExchangeClient;
  private info: InfoClient;

  constructor(privateKey: string, walletAddress: string) {
    if (!privateKey) {
      throw new Error("Hyperliquid private key not configured");
    }
    if (!walletAddress) {
      throw new Error("Hyperliquid wallet address not configured");
    }

    const wallet = privateKeyToAccount(privateKey as `0x${string}`);
    this.address = walletAddress;

    const transport = new HttpTransport();
    this.info = new InfoClient({ transport });
    this.exchange = new ExchangeClient({ wallet, transport });

    logger.info("HyperliquidBot initialized");
  }

  async getBalances(): Promise<SpotBalances> {
    const state = await this.info.spotClearinghouseState({ user: this.address });

    logger.info(`State: ${JSON.stringify(state)}`);

    let usdc = 0;
    let btc = 0;

    for (const balance of state.balances) {
      if (balance.coin === "USDC") {
        usdc = parseFloat(balance.total) - parseFloat(balance.hold);
      } else if (balance.coin === TARGET_TOKEN) {
        btc = parseFloat(balance.total);
      }
    }

    logger.info(`Balances: USDC ${usdc}, BTC ${btc}`);

    return { usdc, btc };
  }

  isLowBalance(usdcBalance: number, threshold: number): boolean {
    return usdcBalance < threshold;
  }

  async buy(usdAmount: number, currentPrice: number, availableUsdc?: number): Promise<BuyResult> {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new Error(`Invalid currentPrice: ${currentPrice}`);
    }
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
      throw new Error(`Invalid usdAmount: ${usdAmount}`);
    }

    const spotMeta = await this.info.spotMeta();

    const btcUniverse = spotMeta.universe.find(
      (pair) => spotMeta.tokens[pair.tokens[0]]?.name === TARGET_TOKEN && pair.tokens[1] === 0
    );

    if (!btcUniverse) {
      throw new Error("BTC/USDC pair not found in spot universe");
    }

    const spotAssetIndex = 10000 + btcUniverse.index;
    const btcToken = spotMeta.tokens[btcUniverse.tokens[0]];
    const szDecimals = btcToken.szDecimals;

    const size = usdAmount / currentPrice;
    const factor = 10 ** szDecimals;
    const roundedSize = Math.ceil(size * factor) / factor;
    const limitPrice = Math.ceil(currentPrice * 1.005);
    const notional = roundedSize * limitPrice;

    if (availableUsdc !== undefined && availableUsdc < notional) {
      throw new InsufficientBalanceError(
        `Insufficient USDC: $${availableUsdc.toFixed(2)} available, $${notional.toFixed(2)} required for a $${usdAmount} order`
      );
    }

    let result: Awaited<ReturnType<typeof this.exchange.order>>;
    try {
      result = await this.exchange.order({
        orders: [{
          a: spotAssetIndex,
          b: true,
          p: limitPrice.toString(),
          s: roundedSize.toString(),
          r: false,
          t: { limit: { tif: "Ioc" } },
        }],
        grouping: "na",
      });
    } catch (error) {
      if (error instanceof HttpRequestError) {
        // Only classify as ambiguous when Hyperliquid actually replied.
        // A transport failure with no HTTP response is retryable and was never sent.
        if (error.response) {
          throw new TransactionSentError({ cause: error });
        }
      }
      throw error;
    }

    const status = result.response.data.statuses[0];

    if (typeof status === "object" && "filled" in status) {
      return {
        filledQty: parseFloat(status.filled.totalSz),
        avgPrice: parseFloat(status.filled.avgPx),
        orderId: status.filled.oid,
      };
    }

    if (typeof status === "object" && "resting" in status) {
      throw new TransactionSentError({ status: "resting", details: status });
    }

    if (typeof status === "object" && "error" in status) {
      throw new Error(`Order failed: ${(status as { error: string }).error}`);
    }

    throw new TransactionSentError({ status: "unknown", raw: status });
  }
}
