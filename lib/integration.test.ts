import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { DCAType } from "@/generated/prisma/enums";

interface TransactionData {
  amount: number;
  price: number;
  dcaType: DCAType;
  reason: string;
  date: Date;
}

interface CreateParams {
  data: TransactionData;
}

describe("integration tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DB_ENCRYPTION_KEY = "a".repeat(64);
    mock.restore();
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.restore();
  });

  describe("end-to-end DCA execution", () => {
    test("completes full DCA flow with multiplier applied", async () => {
      const transactionRecords: TransactionData[] = [];
      const notifications: string[] = [];

      const mockAppConfig = {
        baseAmountToPurchase: 10,
        hyperliquidSymbol: "BTC",
        lowBalanceThreshold: 100,
        cronSecret: "test-secret",
        discordWebhookUrl: "",
        discordEnabled: false,
        configWarningWeeks: 1,
        configDangerWeeks: 2,
        hyperliquidPrivateKey: "encrypted-test-key",
        hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        hyperliquidKeyCreatedDate: new Date(),
      };

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "60000",
                  multiplier: 2,
                  enabled: true,
                },
              ])
            ),
          },
          transaction: {
            create: mock((params: CreateParams) => {
              transactionRecords.push(params.data);
              return Promise.resolve({});
            }),
            findMany: mock(() => Promise.resolve([])),
          },
          $queryRaw: mock(() => Promise.resolve([{ total: 0 }])),
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock((message: string) => {
          notifications.push(message);
          return Promise.resolve();
        }),
      }));

      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() =>
          Promise.resolve({ staleConfigs: [], alertLevel: "none" })
        ),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => Promise.resolve({ filledQty: 0.0002, avgPrice: 50000, orderId: 12345 }));
        },
      }));

      const { runStrategyAsync } = await import("./strategy");
      const result = await runStrategyAsync();

      expect(result.amount).toBe(20);
      expect(result.reason).toBe("Below LTH Realized Price");
      expect(result.orderId).toBe(12345);

      expect(transactionRecords.length).toBe(2);
      expect(transactionRecords[0].dcaType).toBe(DCAType.PROGRAMATIC);
      expect(transactionRecords[0].amount).toBe(0.0002);
      expect(transactionRecords[1].dcaType).toBe(DCAType.FIXED);

      expect(notifications.length).toBe(1);
      expect(notifications[0]).toContain("Trade Executed");
      expect(notifications[0]).toContain("Below LTH Realized Price");
    });

    test("handles transaction failure and sends notification", async () => {
      const notifications: string[] = [];

      const mockAppConfig = {
        baseAmountToPurchase: 10,
        hyperliquidSymbol: "BTC",
        lowBalanceThreshold: 100,
        cronSecret: "test-secret",
        discordWebhookUrl: "",
        discordEnabled: false,
        configWarningWeeks: 1,
        configDangerWeeks: 2,
        hyperliquidPrivateKey: "encrypted-test-key",
        hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        hyperliquidKeyCreatedDate: new Date(),
      };

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
          $queryRaw: mock(() => Promise.resolve([{ total: 0 }])),
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock((message: string) => {
          notifications.push(message);
          return Promise.resolve();
        }),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => Promise.reject(new Error("Insufficient liquidity")));
        },
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Insufficient liquidity");
      }

      expect(notifications.length).toBe(1);
      expect(notifications[0]).toContain("Trade Failed");
      expect(notifications[0]).toContain("Insufficient liquidity");
    });

    test("applies correct priority when multiple multipliers match", async () => {
      const transactionRecords: TransactionData[] = [];

      const mockAppConfig = {
        baseAmountToPurchase: 10,
        hyperliquidSymbol: "BTC",
        lowBalanceThreshold: 100,
        cronSecret: "test-secret",
        discordWebhookUrl: "",
        discordEnabled: false,
        configWarningWeeks: 1,
        configDangerWeeks: 2,
        hyperliquidPrivateKey: "encrypted-test-key",
        hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        hyperliquidKeyCreatedDate: new Date(),
      };

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "60000",
                  multiplier: 3,
                  enabled: true,
                },
                {
                  id: 2,
                  type: "LTH_BUYING",
                  value: "true",
                  multiplier: 2,
                  enabled: true,
                },
                {
                  id: 3,
                  type: "AVERAGE_REALIZED_PRICE",
                  value: "55000",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
          transaction: {
            create: mock((params: CreateParams) => {
              transactionRecords.push(params.data);
              return Promise.resolve({});
            }),
            findMany: mock(() => Promise.resolve([])),
          },
          $queryRaw: mock(() => Promise.resolve([{ total: 0 }])),
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));

      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() =>
          Promise.resolve({ staleConfigs: [], alertLevel: "none" })
        ),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => Promise.resolve({ filledQty: 0.0003, avgPrice: 50000, orderId: 12345 }));
        },
      }));

      const { runStrategyAsync } = await import("./strategy");
      const result = await runStrategyAsync();

      expect(result.amount).toBe(30);
      expect(result.reason).toBe("Below LTH Realized Price");

      expect(transactionRecords[0].reason).toBe("Below LTH Realized Price");
    });
  });

  describe("error handling scenarios", () => {
    test("handles missing price data gracefully", async () => {
      mock.module("./app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
            baseAmountToPurchase: 10,
            hyperliquidPrivateKey: "encrypted-test-key",
            hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            hyperliquidKeyCreatedDate: new Date(),
          })
        ),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.reject(new Error("API unreachable"))),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => Promise.resolve({ filledQty: 0.0002, avgPrice: 50000, orderId: 12345 }));
        },
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("API unreachable");
      }
    });

    test("handles database errors during multiplier config fetch", async () => {
      mock.module("./app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            baseAmountToPurchase: 10,
                hyperliquidSymbol: "BTC",
            lowBalanceThreshold: 100,
            hyperliquidPrivateKey: "encrypted-test-key",
            hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            hyperliquidKeyCreatedDate: new Date(),
          })
        ),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.reject(new Error("Database connection lost"))),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => Promise.resolve({ filledQty: 0.0002, avgPrice: 50000, orderId: 12345 }));
        },
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Database connection lost");
      }
    });

    test("handles swap failures with retries", async () => {
      let attemptCount = 0;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            baseAmountToPurchase: 10,
                hyperliquidSymbol: "BTC",
            lowBalanceThreshold: 100,
            hyperliquidPrivateKey: "encrypted-test-key",
            hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            hyperliquidKeyCreatedDate: new Date(),
          })
        ),
      }));

      mock.module("./encryption", () => ({
        encrypt: (v: string) => v,
        decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      }));

      mock.module("./key-expiry", () => ({
        shouldWarnExpiry: () => false,
        getDaysUntilExpiry: () => 180,
        EXPIRY_DAYS: 180,
        WARNING_THRESHOLD_DAYS: 7,
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError: class InsufficientBalanceError extends Error { constructor(message: string) { super(message); this.name = "InsufficientBalanceError"; } },
        TARGET_TOKEN_DISPLAY: "BTC",
        HyperliquidBot: class MockHyperliquidBot {
          constructor(_privateKey: string, _walletAddress: string) {}
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => {
            attemptCount++;
            return Promise.reject(new Error("Swap failed"));
          });
        },
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
        expect.unreachable("Should have thrown");
      } catch {
        // Expected to fail after all retries
      }

      expect(attemptCount).toBe(4);
    });
  });
});
