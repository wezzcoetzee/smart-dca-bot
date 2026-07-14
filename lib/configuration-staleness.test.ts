import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { MultiplierType } from "@/generated/prisma/enums";

interface FindManyParams {
  where: {
    enabled?: boolean;
    type?: { not: MultiplierType };
  };
}

const DEFAULT_APP_CONFIG = {
  id: "default",
  configWarningWeeks: 1,
  configDangerWeeks: 2,
  baseAmountToPurchase: 10,
  hyperliquidSymbol: "BTC",
  lowBalanceThreshold: 100,
  cronSecret: "secret",
  discordWebhookUrl: "",
  discordEnabled: false,
  hyperliquidPrivateKey: "encrypted-key",
  hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  hyperliquidKeyCreatedDate: new Date(),
  updatedAt: new Date(),
};

describe("configuration-staleness", () => {
  const originalEnv = { ...process.env };
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.restore();
  });

  describe("checkConfigurationStalenessAsync", () => {
    test("returns none when no configs are stale", async () => {
      // #given
      const now = new Date();
      const recentUpdate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_REALIZED_PRICE,
          updatedAt: recentUpdate,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 2 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.alertLevel).toBe("none");
      expect(result.staleConfigs).toEqual([]);
    });

    test("returns warning when config is stale but not critical", async () => {
      // #given
      const now = new Date();
      const staleUpdate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_REALIZED_PRICE,
          updatedAt: staleUpdate,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 3 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.alertLevel).toBe("warning");
      expect(result.staleConfigs.length).toBe(1);
      expect(result.staleConfigs[0].type).toBe(MultiplierType.LTH_REALIZED_PRICE);
      expect(result.staleConfigs[0].weeksStale).toBe(1);
    });

    test("returns danger when config exceeds danger threshold", async () => {
      // #given
      const now = new Date();
      const criticalUpdate = new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.AVERAGE_REALIZED_PRICE,
          updatedAt: criticalUpdate,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 2 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.alertLevel).toBe("danger");
      expect(result.staleConfigs.length).toBe(1);
      expect(result.staleConfigs[0].weeksStale).toBe(3);
    });

    test("calculates weeks stale correctly", async () => {
      // #given
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 2 * MS_PER_WEEK);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_BUYING,
          updatedAt: twoWeeksAgo,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 4 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.staleConfigs[0].weeksStale).toBe(2);
    });

    test("excludes MOVING_AVERAGE type from staleness check", async () => {
      // #given
      let queryParams: FindManyParams | null = null;

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 2 })),
          },
          multiplierConfiguration: {
            findMany: mock((params: FindManyParams) => {
              queryParams = params;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      await checkConfigurationStalenessAsync();

      // #then
      expect(queryParams.where.type.not).toBe(MultiplierType.MOVING_AVERAGE);
    });

    test("only checks enabled configurations", async () => {
      // #given
      let queryParams: FindManyParams | null = null;

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 2 })),
          },
          multiplierConfiguration: {
            findMany: mock((params: FindManyParams) => {
              queryParams = params;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      await checkConfigurationStalenessAsync();

      // #then
      expect(queryParams.where.enabled).toBe(true);
    });

    test("handles multiple stale configs with mixed severity", async () => {
      // #given
      const now = new Date();
      const warningStale = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const dangerStale = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_REALIZED_PRICE,
          updatedAt: warningStale,
        },
        {
          type: MultiplierType.AVERAGE_REALIZED_PRICE,
          updatedAt: dangerStale,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 2 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.alertLevel).toBe("danger");
      expect(result.staleConfigs.length).toBe(2);
    });

    test("includes correct labels for each config type", async () => {
      // #given
      const now = new Date();
      const stale = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_REALIZED_PRICE,
          updatedAt: stale,
        },
        {
          type: MultiplierType.LTH_BUYING,
          updatedAt: stale,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 1, configDangerWeeks: 3 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.staleConfigs[0].label).toBe("LTH Realized Price");
      expect(result.staleConfigs[1].label).toBe("LTH Buying");
    });

    test("uses custom warning and danger thresholds from app config", async () => {
      // #given
      const now = new Date();
      const updateTime = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

      const mockConfigs = [
        {
          type: MultiplierType.LTH_REALIZED_PRICE,
          updatedAt: updateTime,
        },
      ];

      mock.module("./db", () => ({
        default: {
          appConfiguration: {
            findUniqueOrThrow: mock(() => Promise.resolve({ ...DEFAULT_APP_CONFIG, configWarningWeeks: 3, configDangerWeeks: 5 })),
          },
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      // #when
      const { checkConfigurationStalenessAsync } = await import("./configuration-staleness");
      const result = await checkConfigurationStalenessAsync();

      // #then
      expect(result.alertLevel).toBe("none");
      expect(result.staleConfigs).toEqual([]);
    });
  });

  describe("MULTIPLIER_TYPE_LABELS", () => {
    test("exports correct labels for all multiplier types", async () => {
      const { MULTIPLIER_TYPE_LABELS } = await import("./configuration-staleness");

      expect(MULTIPLIER_TYPE_LABELS[MultiplierType.MOVING_AVERAGE]).toBe("Moving Average");
      expect(MULTIPLIER_TYPE_LABELS[MultiplierType.LTH_REALIZED_PRICE]).toBe("LTH Realized Price");
      expect(MULTIPLIER_TYPE_LABELS[MultiplierType.AVERAGE_REALIZED_PRICE]).toBe("Average Realized Price");
      expect(MULTIPLIER_TYPE_LABELS[MultiplierType.LTH_BUYING]).toBe("LTH Buying");
    });
  });
});
