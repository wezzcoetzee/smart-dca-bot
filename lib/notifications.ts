import * as discord from "./discord";
import { createLogger } from "./logger";

const logger = createLogger({ symbol: "notifications" });

export async function sendNotification(message: string): Promise<void> {
  const results = await Promise.allSettled([
    discord.sendMessage(message),
  ]);

  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      const channel = "Discord";
      logger.error(`${channel} notification failed`, result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
    }
  }
}
