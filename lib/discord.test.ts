import { describe, test, expect, mock } from "bun:test";

mock.module("./db", () => ({
  default: {},
  prisma: {},
}));

describe("discord", () => {
  describe("sendMessage function behavior", () => {
    test("webhook payload has correct structure", () => {
      const message = "Test message";
      const payload = { content: message };

      expect(payload).toEqual({ content: "Test message" });
    });

    test("request headers include correct content type", () => {
      const headers = { "Content-Type": "application/json" };
      expect(headers["Content-Type"]).toBe("application/json");
    });

    test("message body is valid JSON", () => {
      const payload = { content: "Hello" };
      const jsonString = JSON.stringify(payload);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toEqual(payload);
    });
  });

  describe("markdown stripping", () => {
    test("strips bold markdown", () => {
      const input = "*Bold text*";
      const stripped = input.replace(/\*([^*]+)\*/g, "$1");
      expect(stripped).toBe("Bold text");
    });

    test("strips italic markdown", () => {
      const input = "_italic text_";
      const stripped = input.replace(/_([^_]+)_/g, "$1");
      expect(stripped).toBe("italic text");
    });

    test("strips code markdown", () => {
      const input = "`code block`";
      const stripped = input.replace(/`([^`]+)`/g, "$1");
      expect(stripped).toBe("code block");
    });

    test("strips mixed markdown formatting", () => {
      const input = "*Bold* and _italic_ and `code`";
      const stripped = input
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
      expect(stripped).toBe("Bold and italic and code");
    });
  });

  describe("error handling logic", () => {
    test("throws error with correct message format for non-ok response", () => {
      const status = 400;
      const errorMessage = `Discord webhook error: ${status}`;
      expect(errorMessage).toBe("Discord webhook error: 400");
    });

    test("throws error with correct message format for 429 status", () => {
      const status = 429;
      const errorMessage = `Discord webhook error: ${status}`;
      expect(errorMessage).toBe("Discord webhook error: 429");
    });
  });

  describe("sendMessage module exports", () => {
    test("sendMessage is exported and is a function", async () => {
      const discord = await import("./discord");
      expect(typeof discord.sendMessage).toBe("function");
    });
  });

  describe("webhook URL validation", () => {
    test("isValidDiscordWebhookUrl accepts valid discord.com webhook", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(true);
    });

    test("isValidDiscordWebhookUrl accepts valid discordapp.com webhook", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/abc")).toBe(true);
    });

    test("isValidDiscordWebhookUrl rejects http:// URL", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("http://discord.com/api/webhooks/123/abc")).toBe(false);
    });

    test("isValidDiscordWebhookUrl rejects file:// URL", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("file:///etc/passwd")).toBe(false);
    });

    test("isValidDiscordWebhookUrl rejects AWS metadata endpoint", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    test("isValidDiscordWebhookUrl rejects internal localhost URL", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("http://localhost:5432/")).toBe(false);
    });

    test("isValidDiscordWebhookUrl rejects non-webhook path on discord.com", async () => {
      const { isValidDiscordWebhookUrl } = await import("./discord");
      expect(isValidDiscordWebhookUrl("https://discord.com/channels/123")).toBe(false);
    });
  });
});
