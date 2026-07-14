import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { runStrategyAsync } from "@/lib/strategy";

const logger = createLogger({ symbol: "trigger-bot" });

export async function POST() {
  try {
    logger.info("Manual trigger initiated");
    const results = await runStrategyAsync();

    logger.info("Manual trigger completed", { amount: results.amount, reason: results.reason });
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

    logger.error("Manual trigger failed", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
