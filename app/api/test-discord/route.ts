import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { sendMessage as sendDiscordMessage } from "@/lib/discord";

const logger = createLogger({ symbol: "test-notifications" });

export async function POST() {
  try {
    const testMessage = `🧪 **Test Notification**\n\nYour Discord notifications are working correctly!\n\n_Sent from Smart DCA Bot_`;

    await sendDiscordMessage(testMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to send test message", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to send test message" },
      { status: 500 }
    );
  }
}
