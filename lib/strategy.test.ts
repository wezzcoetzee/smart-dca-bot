import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

const originalEnv = { ...process.env };

describe("strategy", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.HYPERLIQUID_SYMBOL = "BTC";
    process.env.BASE_AMOUNT_TO_PURCHASE = "10";
    process.env.TARGET_TOKEN_SYMBOL = "BTC";
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.restore();
  });

  describe("determineAmountToBuyAsync", () => {
    test("returns base amount when no multipliers match", async () => {
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

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("returns base amount when multipliers exist but are disabled", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "40000",
                  multiplier: 2,
                  enabled: false,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("applies LTH_REALIZED_PRICE multiplier when current price is below threshold", async () => {
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
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(20);
      expect(result.reason).toBe("Below LTH Realized Price");
    });

    test("does not apply LTH_REALIZED_PRICE when current price is above threshold", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "40000",
                  multiplier: 2,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("applies LTH_BUYING multiplier when value is truthy", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_BUYING",
                  value: "true",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(15);
      expect(result.reason).toBe("LTH Buying");
    });

    test("applies AVERAGE_REALIZED_PRICE multiplier when current price is below average", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "AVERAGE_REALIZED_PRICE",
                  value: "55000",
                  multiplier: 1.75,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(17.5);
      expect(result.reason).toBe("Below Average Realized Price");
    });

    test("applies MOVING_AVERAGE multiplier when current price is below moving average", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "MOVING_AVERAGE",
                  value: "200",
                  multiplier: 1.25,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([55000, 58000, 60000])),
        calculateSMA: mock(() => 57666),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(12.5);
      expect(result.reason).toBe("Below Moving Average");
    });

    test("prioritizes LTH_REALIZED_PRICE over other multipliers", async () => {
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
                {
                  id: 2,
                  type: "LTH_BUYING",
                  value: "true",
                  multiplier: 1.5,
                  enabled: true,
                },
                {
                  id: 3,
                  type: "AVERAGE_REALIZED_PRICE",
                  value: "55000",
                  multiplier: 1.75,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(20);
      expect(result.reason).toBe("Below LTH Realized Price");
    });

    test("falls through to LTH_BUYING when LTH_REALIZED_PRICE does not match", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "40000",
                  multiplier: 2,
                  enabled: true,
                },
                {
                  id: 2,
                  type: "LTH_BUYING",
                  value: "true",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(15);
      expect(result.reason).toBe("LTH Buying");
    });
  });

  describe("runStrategyAsync", () => {
    beforeEach(() => {
      process.env.DB_ENCRYPTION_KEY = "a".repeat(64);

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
    });

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

    test("orchestrates full flow and returns correct result", async () => {
      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
          transaction: {
            create: mock(() => Promise.resolve({})),
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
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() =>
            Promise.resolve({ usdc: 1000, btc: 0.5 })
          );
          isLowBalance = mock(() => false);
          buy = mock(() =>
            Promise.resolve({
              filledQty: 0.0002,
              avgPrice: 50000,
              orderId: 12345,
            })
          );
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      const { runStrategyAsync } = await import("./strategy");
      const result = await runStrategyAsync();

      expect(result.amount).toBe(10);
      expect(result.filledQty).toBe(0.0002);
      expect(result.orderId).toBe(12345);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("saves both PROGRAMATIC and FIXED transaction types", async () => {
      const createCalls: { data: { amount: number; price: number; reason: string; dcaType: string } }[] = [];

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
          transaction: {
            create: mock((args: { data: { amount: number; price: number; reason: string; dcaType: string } }) => {
              createCalls.push(args);
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
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() =>
            Promise.resolve({ usdc: 1000, btc: 0.5 })
          );
          isLowBalance = mock(() => false);
          buy = mock(() =>
            Promise.resolve({
              filledQty: 0.0002,
              avgPrice: 50000,
              orderId: 12345,
            })
          );
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      const { runStrategyAsync } = await import("./strategy");
      await runStrategyAsync();

      expect(createCalls.length).toBe(2);
      expect(createCalls[0].data.dcaType).toBe("PROGRAMATIC");
      expect(createCalls[0].data.amount).toBe(0.0002);
      expect(createCalls[1].data.dcaType).toBe("FIXED");
      expect(createCalls[1].data.reason).toBe("Normal DCA");
    });

    test("sends notification after purchase", async () => {
      let messageSent = false;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
      }));

      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
          transaction: {
            create: mock(() => Promise.resolve({})),
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
        sendNotification: mock(() => {
          messageSent = true;
          return Promise.resolve();
        }),
      }));

      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() =>
            Promise.resolve({ usdc: 1000, btc: 0.5 })
          );
          isLowBalance = mock(() => false);
          buy = mock(() =>
            Promise.resolve({
              filledQty: 0.0002,
              avgPrice: 50000,
              orderId: 12345,
            })
          );
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      const { runStrategyAsync } = await import("./strategy");
      await runStrategyAsync();

      expect(messageSent).toBe(true);
    });

    test("sends failure notification on error", async () => {
      let failureMessageSent = false;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.reject(new Error("Config error"))),
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => {
          failureMessageSent = true;
          return Promise.resolve();
        }),
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
      } catch {
        // Expected to throw
      }

      expect(failureMessageSent).toBe(true);
    });

    test("TransactionSentError is not retried and propagates immediately", async () => {
      let attemptCount = 0;
      let notificationSent = false;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
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
        sendNotification: mock(() => {
          notificationSent = true;
          return Promise.resolve();
        }),
      }));

      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));

      const { TransactionSentError } = await import("./hyperliquid-bot");

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError,
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => {
            attemptCount++;
            return Promise.reject(new TransactionSentError({ orderId: "ambiguous-123" }));
          });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      const { runStrategyAsync } = await import("./strategy");

      // #when
      let thrownError: unknown;
      try {
        await runStrategyAsync();
      } catch (err) {
        thrownError = err;
      }

      // #then — only 1 attempt, never retried
      expect(attemptCount).toBe(1);
      expect(thrownError).toBeInstanceOf(TransactionSentError);
      expect(notificationSent).toBe(true);
    });

    test("InsufficientBalanceError is not retried and propagates immediately", async () => {
      let attemptCount = 0;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
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

      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));

      const { InsufficientBalanceError } = await import("./hyperliquid-bot");

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        InsufficientBalanceError,
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => {
            attemptCount++;
            return Promise.reject(new InsufficientBalanceError("Insufficient USDC: $10.00 available, $10.82 required"));
          });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      const { runStrategyAsync } = await import("./strategy");

      // #when
      let thrownError: unknown;
      try {
        await runStrategyAsync();
      } catch (err) {
        thrownError = err;
      }

      // #then — only 1 attempt, never retried
      expect(attemptCount).toBe(1);
      expect(thrownError).toBeInstanceOf(InsufficientBalanceError);
    });

    test("retries failed transactions up to max retries", async () => {
      let attemptCount = 0;

      mock.module("./app-config", () => ({
        getAppConfig: mock(() => Promise.resolve(mockAppConfig)),
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

      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class MockHyperliquidBot {
          address = "0x1234567890abcdef1234567890abcdef12345678";
          getBalances = mock(() =>
            Promise.resolve({ usdc: 1000, btc: 0.5 })
          );
          isLowBalance = mock(() => false);
          buy = mock(() => {
            attemptCount++;
            return Promise.reject(new Error("Swap failed"));
          });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));

      const { runStrategyAsync } = await import("./strategy");

      try {
        await runStrategyAsync();
      } catch {
        // Expected to fail
      }

      expect(attemptCount).toBe(4);
    });
  });

  describe("determineAmountToBuyAsync edge cases", () => {
    test("handles invalid MOVING_AVERAGE days value", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "MOVING_AVERAGE",
                  value: "invalid",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("handles zero days for MOVING_AVERAGE", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "MOVING_AVERAGE",
                  value: "0",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
    });

    test("handles negative days for MOVING_AVERAGE", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "MOVING_AVERAGE",
                  value: "-10",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
    });

    test("handles exact price match for LTH_REALIZED_PRICE", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "50000",
                  multiplier: 2,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(20);
      expect(result.reason).toBe("Below LTH Realized Price");
    });

    test("handles LTH_BUYING with false value", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_BUYING",
                  value: "false",
                  multiplier: 1.5,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(10);
      expect(result.reason).toBe("No multiplier conditions met");
    });

    test("handles multiple multipliers of same type", async () => {
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
                {
                  id: 2,
                  type: "LTH_REALIZED_PRICE",
                  value: "55000",
                  multiplier: 3,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(20);
    });

    test("handles very large multipliers", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "60000",
                  multiplier: 100,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBe(1000);
    });

    test("handles fractional multipliers correctly", async () => {
      mock.module("./db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() =>
              Promise.resolve([
                {
                  id: 1,
                  type: "LTH_REALIZED_PRICE",
                  value: "60000",
                  multiplier: 1.123,
                  enabled: true,
                },
              ])
            ),
          },
        },
      }));

      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));

      const { determineAmountToBuyAsync } = await import("./strategy");
      const result = await determineAmountToBuyAsync(10, 50000, "BTC");

      expect(result.amount).toBeCloseTo(11.23, 2);
    });
  });

  describe("executeBuyWithRetry", () => {
    beforeEach(() => {
      process.env.DB_ENCRYPTION_KEY = "a".repeat(64);

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

      mock.module("./notifications", () => ({
        sendNotification: mock(() => Promise.resolve()),
      }));
    });

    const mockConfig = {
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

    const baseDbMock = () => ({
      default: {
        multiplierConfiguration: { findMany: mock(() => Promise.resolve([])) },
        transaction: {
          create: mock(() => Promise.resolve({})),
          findMany: mock(() => Promise.resolve([])),
        },
        $queryRaw: mock(() => Promise.resolve([{ total: 0 }])),
      },
    });

    test("retries transient errors up to maxRetries then throws", async () => {
      // #given
      let callCount = 0;

      mock.module("./app-config", () => ({ getAppConfig: mock(() => Promise.resolve(mockConfig)) }));
      mock.module("./db", () => baseDbMock());
      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));
      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));
      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class {
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => { callCount++; throw new Error("transient network error"); });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      // #when
      const { runStrategyAsync } = await import("./strategy");
      await expect(runStrategyAsync()).rejects.toThrow("transient network error");

      // #then — initial attempt + 3 retries = 4 total calls
      expect(callCount).toBe(4);
    });

    test("succeeds on retry after a transient error", async () => {
      // #given
      let callCount = 0;

      mock.module("./app-config", () => ({ getAppConfig: mock(() => Promise.resolve(mockConfig)) }));
      mock.module("./db", () => baseDbMock());
      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));
      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));
      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class {
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => {
            callCount++;
            if (callCount === 1) throw new Error("transient");
            return Promise.resolve({ filledQty: 0.0002, avgPrice: 50000, orderId: 99 });
          });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      // #when
      const { runStrategyAsync } = await import("./strategy");
      const result = await runStrategyAsync();

      // #then
      expect(result.filledQty).toBe(0.0002);
      expect(callCount).toBe(2);
    });

    test("retry budget is respected — stops after exactly initial + maxRetries attempts", async () => {
      // #given
      let callCount = 0;

      mock.module("./app-config", () => ({ getAppConfig: mock(() => Promise.resolve(mockConfig)) }));
      mock.module("./db", () => baseDbMock());
      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));
      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));
      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: class TransactionSentError extends Error { constructor(public readonly details: unknown) { super("Order sent but outcome is ambiguous"); this.name = "TransactionSentError"; } },
        HyperliquidBot: class {
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => { callCount++; throw new Error("always fails"); });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      // #when
      const { runStrategyAsync } = await import("./strategy");
      await expect(runStrategyAsync()).rejects.toThrow();

      // #then — never exceeds 4 (initial + 3 retries), never over-retries
      expect(callCount).toBe(4);
    });

    test("does not retry when TransactionSentError is thrown (anti double-spend)", async () => {
      // #given
      let callCount = 0;
      const SentError = class TransactionSentError extends Error {
        constructor(public readonly details: unknown) {
          super("Order sent but outcome is ambiguous");
          this.name = "TransactionSentError";
        }
      };

      mock.module("./app-config", () => ({ getAppConfig: mock(() => Promise.resolve(mockConfig)) }));
      mock.module("./db", () => baseDbMock());
      mock.module("./hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
        getHistoricalPrices: mock(() => Promise.resolve([])),
        calculateSMA: mock(() => 0),
      }));
      mock.module("./configuration-staleness", () => ({
        checkConfigurationStalenessAsync: mock(() => Promise.resolve({ staleConfigs: [], alertLevel: "none" })),
      }));
      mock.module("./hyperliquid-bot", () => ({
        TransactionSentError: SentError,
        HyperliquidBot: class {
          getBalances = mock(() => Promise.resolve({ usdc: 1000, btc: 0.5 }));
          isLowBalance = mock(() => false);
          buy = mock(() => { callCount++; throw new SentError({ status: "unknown" }); });
        },
        TARGET_TOKEN_DISPLAY: "BTC",
      }));

      // #when
      const { runStrategyAsync } = await import("./strategy");
      await expect(runStrategyAsync()).rejects.toThrow("Order sent but outcome is ambiguous");

      // #then — never retried; exactly one buy attempt
      expect(callCount).toBe(1);
    });
  });

});
