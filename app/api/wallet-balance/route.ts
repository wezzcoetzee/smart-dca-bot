import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import { decrypt } from "@/lib/encryption";
import { HyperliquidBot } from "@/lib/hyperliquid-bot";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ symbol: "wallet" });

export async function GET() {
  try {
    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json(
        { error: "DB_ENCRYPTION_KEY not configured" },
        { status: 500 }
      );
    }

    const appConfig = await getAppConfig();
    const privateKey = decrypt(appConfig.hyperliquidPrivateKey, encryptionKey);
    const bot = new HyperliquidBot(privateKey, appConfig.hyperliquidWalletAddress);
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
