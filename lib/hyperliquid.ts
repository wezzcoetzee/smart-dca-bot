import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { createLogger } from "./logger";

const logger = createLogger({ symbol: "hyperliquid" });

const info = new InfoClient({ transport: new HttpTransport() });

export async function getCurrentPrice(symbol: string): Promise<number> {
  const mids = await info.allMids();
  const price = mids[symbol];

  if (!price) {
    throw new Error(`Price not found for symbol: ${symbol}`);
  }

  logger.debug(`Price fetched for ${symbol}: ${price}`);
  return parseFloat(price);
}

export async function getHistoricalPrices(
  symbol: string,
  days: number
): Promise<number[]> {
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const candles = await info.candleSnapshot({
    coin: symbol,
    interval: "1d",
    startTime,
    endTime,
  });

  logger.debug(`Fetched ${candles.length} candles for ${symbol} (${days}d)`);
  return candles.map((candle) => parseFloat(candle.c));
}

export function calculateSMA(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return sum / prices.length;
}
