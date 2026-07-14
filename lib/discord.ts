import { getAppConfig } from "./app-config";
import { createLogger } from "./logger";
import { discordNotificationTotal } from "./metrics";

const logger = createLogger({ symbol: "discord" });

export function isValidDiscordWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "discord.com" || parsed.hostname === "discordapp.com") &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

function stripMarkdown(message: string): string {
  return message
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export async function sendMessage(message: string): Promise<void> {
  const config = await getAppConfig();

  if (!config.discordEnabled || !config.discordWebhookUrl) {
    return;
  }

  if (!isValidDiscordWebhookUrl(config.discordWebhookUrl)) {
    throw new Error("Invalid Discord webhook URL");
  }

  const response = await fetch(config.discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: stripMarkdown(message) }),
  });

  if (!response.ok) {
    discordNotificationTotal.labels("failure").inc();
    throw new Error(`Discord webhook error: ${response.status}`);
  }

  discordNotificationTotal.labels("success").inc();
  logger.info("Message sent successfully");
}
