import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppConfig, updateAppConfig, AppConfig } from "@/lib/app-config";
import { encrypt } from "@/lib/encryption";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ symbol: "config" });

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const MASKED_VALUE = "••••••••";

const updateSchema = z.object({
  baseAmountToPurchase: z.number().positive().max(10_000).optional(),
  hyperliquidSymbol: z.string().min(1).max(16).optional(),
  lowBalanceThreshold: z.number().nonnegative().optional(),
  cronSecret: z.union([z.string().min(16), z.literal(MASKED_VALUE)]).optional(),
  discordWebhookUrl: z.union([z.string().url(), z.literal(MASKED_VALUE)]).optional(),
  discordEnabled: z.boolean().optional(),
  configWarningWeeks: z.number().int().min(1).max(52).optional(),
  configDangerWeeks: z.number().int().min(1).max(52).optional(),
  hyperliquidPrivateKey: z.string().optional(),
  hyperliquidWalletAddress: z.union([z.string().regex(/^0x[0-9a-fA-F]{40}$/), z.literal(MASKED_VALUE)]).optional(),
  hyperliquidKeyCreatedDate: z.coerce.date().optional(),
}).strict();

export async function GET(): Promise<NextResponse<ApiResponse<AppConfig>>> {
  try {
    const config = await getAppConfig();
    const masked = {
      ...config,
      hyperliquidPrivateKey: config.hyperliquidPrivateKey ? MASKED_VALUE : "",
      cronSecret: config.cronSecret ? MASKED_VALUE : "",
      discordWebhookUrl: config.discordWebhookUrl ? MASKED_VALUE : "",
      hyperliquidWalletAddress: config.hyperliquidWalletAddress ? MASKED_VALUE : "",
    };
    return NextResponse.json({ success: true, data: masked });
  } catch (error) {
    logger.error("Failed to get app configuration", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Failed to get configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const json = await request.json();
    const parseResult = updateSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request data", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const body = parseResult.data as Record<string, unknown>;

    if (body.hyperliquidPrivateKey && body.hyperliquidPrivateKey !== MASKED_VALUE) {
      const encryptionKey = process.env.DB_ENCRYPTION_KEY;
      if (!encryptionKey) {
        return NextResponse.json(
          { success: false, error: "DB_ENCRYPTION_KEY not configured" },
          { status: 500 }
        );
      }
      body.hyperliquidPrivateKey = encrypt(body.hyperliquidPrivateKey as string, encryptionKey);
    } else if (body.hyperliquidPrivateKey === MASKED_VALUE) {
      delete body.hyperliquidPrivateKey;
    }

    for (const field of ["cronSecret", "discordWebhookUrl", "hyperliquidWalletAddress"] as const) {
      if (body[field] === MASKED_VALUE) {
        delete body[field];
      }
    }

    await updateAppConfig(body as Partial<AppConfig>);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("Failed to update app configuration", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
