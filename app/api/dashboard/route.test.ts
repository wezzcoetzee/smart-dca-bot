import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { NextRequest } from "next/server";

interface WhereClause {
  date?: {
    gte?: Date;
    lte?: Date;
  };
}

interface OrderByParam {
  date?: string;
}

interface FindManyParams {
  where: WhereClause;
  orderBy?: OrderByParam;
}

describe("api/dashboard/route", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  describe("GET", () => {
    test("returns dashboard data for 1m period", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "PROGRAMATIC",
          reason: "Below LTH Realized Price",
        },
        {
          id: 2,
          amount: 0.0001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "FIXED",
          reason: "Normal DCA",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(51000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(data.chartData).toBeDefined();
      expect(data.transactions).toBeDefined();
    });

    test("defaults to 1m period when not specified", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      let capturedWhereClause: WhereClause | null = null;
      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock((params: FindManyParams) => {
              capturedWhereClause = params.where;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard");
      await GET(request);

      expect(capturedWhereClause.date).toBeDefined();
      expect(capturedWhereClause.date.gte).toBeDefined();
      expect(capturedWhereClause.date.lte).toBeDefined();
    });

    test("calculates cumulative BTC amounts correctly", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
        {
          id: 2,
          amount: 0.002,
          price: 50000,
          date: new Date("2025-01-16"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(data.summary.programaticBtcAmount).toBe(0.003);
    });

    test("calculates percentage difference correctly", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.002,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
        {
          id: 2,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "FIXED",
          reason: "Normal",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(data.summary.percentageDifference).toBe(100);
    });

    test("handles empty transactions array", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve([])),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chartData).toEqual([]);
      expect(data.transactions).toEqual([]);
      expect(data.summary.totalProgramaticValue).toBe(0);
    });

    test("orders transactions by date ascending for chart", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-10"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
        {
          id: 2,
          amount: 0.001,
          price: 51000,
          date: new Date("2025-01-12"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      let orderByParam: OrderByParam | null = null;
      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock((params: FindManyParams) => {
              orderByParam = params.orderBy;
              return Promise.resolve(mockTransactions);
            }),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      await GET(request);

      expect(orderByParam).toEqual({ date: "asc" });
    });

    test("reverses transaction list for display", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-10"),
          dcaType: "PROGRAMATIC",
          reason: "First",
        },
        {
          id: 2,
          amount: 0.001,
          price: 51000,
          date: new Date("2025-01-12"),
          dcaType: "PROGRAMATIC",
          reason: "Second",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(data.transactions[0].reason).toBe("Second");
      expect(data.transactions[1].reason).toBe("First");
    });

    test("filters transactions by period=1y", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      let capturedWhereClause: WhereClause | null = null;
      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock((params: FindManyParams) => {
              capturedWhereClause = params.where;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1y");
      await GET(request);

      const timeDiff = capturedWhereClause.date.lte.getTime() - capturedWhereClause.date.gte.getTime();
      const daysApprox = timeDiff / (24 * 60 * 60 * 1000);

      expect(daysApprox).toBeGreaterThan(350);
      expect(daysApprox).toBeLessThan(370);
    });

    test("filters transactions by period=all using epoch origin", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      let capturedWhereClause: WhereClause | null = null;
      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock((params: FindManyParams) => {
              capturedWhereClause = params.where;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=all");
      await GET(request);

      expect(capturedWhereClause.date.gte.getTime()).toBe(0);
    });

    test("returns 500 on database error", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.reject(new Error("Database error"))),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch dashboard data");
    });

    test("returns 500 on price fetch error", async () => {
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve([])),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.reject(new Error("Price fetch error"))),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch dashboard data");
    });

    test("includes BTC price in chart data points", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "PROGRAMATIC",
          reason: "Test",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(51000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(data.chartData[0].btcPrice).toBe(50000);
    });

    test("excludes FIXED transactions from transaction list", async () => {
      const mockTransactions = [
        {
          id: 1,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "PROGRAMATIC",
          reason: "Programatic",
        },
        {
          id: 2,
          amount: 0.001,
          price: 50000,
          date: new Date("2025-01-15"),
          dcaType: "FIXED",
          reason: "Fixed",
        },
      ];

      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() =>
          Promise.resolve({
            hyperliquidSymbol: "BTC",
          })
        ),
      }));

      mock.module("@/lib/db", () => ({
        default: {
          transaction: {
            findMany: mock(() => Promise.resolve(mockTransactions)),
          },
        },
      }));

      mock.module("@/lib/hyperliquid", () => ({
        getCurrentPrice: mock(() => Promise.resolve(50000)),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/dashboard?period=1m");
      const response = await GET(request);
      const data = await response.json();

      expect(data.transactions.length).toBe(1);
      expect(data.transactions[0].reason).toBe("Programatic");
    });
  });
});
