import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

interface UpsertParams {
  where: { id: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

const DB_CONFIG = {
  id: "default",
  baseAmountToPurchase: 15,
  hyperliquidSymbol: "ETH",
  lowBalanceThreshold: 200,
  cronSecret: "db-secret",
  discordWebhookUrl: "https://discord.com/webhook",
  discordEnabled: true,
  configWarningWeeks: 2,
  configDangerWeeks: 4,
  updatedAt: new Date(),
};

const mockFindUniqueOrThrow = mock(() => Promise.resolve(DB_CONFIG));
const mockUpsert = mock(() => Promise.resolve({}));

mock.module("./db", () => ({
  default: {
    appConfiguration: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      upsert: mockUpsert,
    },
  },
}));

const { getAppConfig, updateAppConfig } = await import("./app-config");

describe("app-config", () => {
  beforeEach(() => {
    mockFindUniqueOrThrow.mockReset();
    mockUpsert.mockReset();
  });

  afterEach(() => {
    mockFindUniqueOrThrow.mockReset();
    mockUpsert.mockReset();
  });

  describe("getAppConfig", () => {
    test("returns config from database", async () => {
      // #given
      mockFindUniqueOrThrow.mockResolvedValueOnce(DB_CONFIG);

      // #when
      const config = await getAppConfig();

      // #then
      expect(config.baseAmountToPurchase).toBe(15);
      expect(config.lowBalanceThreshold).toBe(200);
      expect(config.discordWebhookUrl).toBe("https://discord.com/webhook");
    });

    test("throws when no config row exists", async () => {
      // #given
      mockFindUniqueOrThrow.mockRejectedValueOnce(new Error("No AppConfiguration found"));

      // #when / #then
      expect(getAppConfig()).rejects.toThrow("No AppConfiguration found");
    });
  });

  describe("updateAppConfig", () => {
    test("creates new config when none exists", async () => {
      // #given
      let capturedData: UpsertParams | null = null;
      mockUpsert.mockImplementationOnce((params: UpsertParams) => {
        capturedData = params;
        return Promise.resolve({});
      });

      // #when
      await updateAppConfig({
        baseAmountToPurchase: 20,
        lowBalanceThreshold: 150,
      });

      // #then
      expect(capturedData!.where.id).toBe("default");
      expect(capturedData!.create.baseAmountToPurchase).toBe(20);
      expect(capturedData!.create.lowBalanceThreshold).toBe(150);
    });

    test("updates existing config", async () => {
      // #given
      let capturedData: UpsertParams | null = null;
      mockUpsert.mockImplementationOnce((params: UpsertParams) => {
        capturedData = params;
        return Promise.resolve({});
      });

      // #when
      await updateAppConfig({
        hyperliquidSymbol: "ETH",
        baseAmountToPurchase: 30,
      });

      // #then
      expect(capturedData!.update.hyperliquidSymbol).toBe("ETH");
      expect(capturedData!.update.baseAmountToPurchase).toBe(30);
    });

    test("only updates provided fields", async () => {
      // #given
      let capturedData: UpsertParams | null = null;
      mockUpsert.mockImplementationOnce((params: UpsertParams) => {
        capturedData = params;
        return Promise.resolve({});
      });

      // #when
      await updateAppConfig({
        lowBalanceThreshold: 50,
      });

      // #then
      expect(capturedData!.update.lowBalanceThreshold).toBe(50);
      expect(capturedData!.update.baseAmountToPurchase).toBeUndefined();
      expect(capturedData!.update.hyperliquidSymbol).toBeUndefined();
    });

    test("spreads config into create block", async () => {
      // #given
      let capturedData: UpsertParams | null = null;
      mockUpsert.mockImplementationOnce((params: UpsertParams) => {
        capturedData = params;
        return Promise.resolve({});
      });

      // #when
      await updateAppConfig({});

      // #then
      expect(capturedData!.create.id).toBe("default");
    });
  });
});
