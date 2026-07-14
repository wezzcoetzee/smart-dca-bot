import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import { createLogger } from "@/lib/logger";
import { runStrategyAsync } from "@/lib/strategy";

const logger = createLogger({ symbol: "cron" });

export async function GET(request: NextRequest) {
  const appConfig = await getAppConfig();
  const authHeader = request.headers.get("authorization");

  if (appConfig.cronSecret && authHeader !== `Bearer ${appConfig.cronSecret}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Execution triggered");
    const results = await runStrategyAsync();

    logger.info("Execution completed", { amount: results.amount, reason: results.reason });
    return NextResponse.json({
      success: true,
      amount: results.amount,
      reason: results.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "Strategy already in progress") {
      logger.warn("Concurrent execution blocked — another run is in progress");
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }

    logger.error("Execution failed", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
