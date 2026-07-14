import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

describe("hyperliquid", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    mock.restore();
  });

  afterEach(() => {
    process.env = originalEnv;
    mock.restore();
  });

  describe("calculateSMA", () => {
    test("calculates simple moving average correctly", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [100, 200, 300];
      const sma = calculateSMA(prices);

      expect(sma).toBe(200);
    });

    test("returns 0 for empty array", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const sma = calculateSMA([]);

      expect(sma).toBe(0);
    });

    test("calculates average for single price", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const sma = calculateSMA([50000]);

      expect(sma).toBe(50000);
    });

    test("handles decimal prices correctly", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [50000.5, 51000.5, 52000.5];
      const sma = calculateSMA(prices);

      expect(sma).toBeCloseTo(51000.5, 2);
    });

    test("calculates average for large price arrays", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = Array(200).fill(50000);
      const sma = calculateSMA(prices);

      expect(sma).toBe(50000);
    });

    test("handles varying prices correctly", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [45000, 50000, 55000, 60000];
      const sma = calculateSMA(prices);

      expect(sma).toBe(52500);
    });

    test("handles negative prices", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [-100, -200, -300];
      const sma = calculateSMA(prices);

      expect(sma).toBe(-200);
    });

    test("handles mixed positive and negative prices", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [-50, 0, 50, 100];
      const sma = calculateSMA(prices);

      expect(sma).toBe(25);
    });

    test("handles very small decimal values", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [0.0001, 0.0002, 0.0003];
      const sma = calculateSMA(prices);

      expect(sma).toBeCloseTo(0.0002, 6);
    });

    test("handles very large values", async () => {
      const { calculateSMA } = await import("./hyperliquid");
      const prices = [1000000, 2000000, 3000000];
      const sma = calculateSMA(prices);

      expect(sma).toBe(2000000);
    });
  });
});
