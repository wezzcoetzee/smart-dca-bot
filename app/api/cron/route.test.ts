import { describe, test, expect, mock } from "bun:test";
import { NextRequest } from "next/server";

const noop = () => {};
const noopLogger = { log: noop, info: noop, warn: noop, error: noop, debug: noop };

function mockInfra() {
  mock.module("@/lib/logger", () => ({
    createLogger: () => noopLogger,
    log: noop, info: noop, warn: noop, error: noop, debug: noop,
  }));
  mock.module("@/lib/db", () => ({ default: {}, prisma: {} }));
}

describe("api/cron/route", () => {
  describe("GET", () => {
    test("returns 401 when authorization header is missing", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 401 when authorization header is incorrect", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "correct-secret" })),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    test("accepts request with correct authorization", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "correct-secret" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.resolve({
          amount: 10, outAmount: "100000", swapTxSignature: "sig123", reason: "Test reason",
        })),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        headers: { authorization: "Bearer correct-secret" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test("returns success with strategy results", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.resolve({
          amount: 20, outAmount: "200000", swapTxSignature: "sig456", reason: "Below LTH Realized Price",
        })),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        headers: { authorization: "Bearer test-secret" },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.amount).toBe(20);
      expect(data.reason).toBe("Below LTH Realized Price");
    });

    test("allows request when cronSecret is empty", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.resolve({
          amount: 10, outAmount: "100000", swapTxSignature: "sig123", reason: "Test",
        })),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron");
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    test("returns 500 when strategy throws error", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.reject(new Error("Strategy failed"))),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        headers: { authorization: "Bearer test-secret" },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Internal error");
      expect(data.error).not.toBe("Strategy failed");
    });

    test("handles unknown error types", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.reject("String error")),
      }));

      const { GET } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        headers: { authorization: "Bearer test-secret" },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal error");
      expect(data.error).not.toBe("String error");
    });
  });

  describe("POST", () => {
    test("delegates to GET handler", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));
      mock.module("@/lib/strategy", () => ({
        runStrategyAsync: mock(() => Promise.resolve({
          amount: 10, outAmount: "100000", swapTxSignature: "sig123", reason: "Test",
        })),
      }));

      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    test("POST requires same authorization as GET", async () => {
      mockInfra();
      mock.module("@/lib/app-config", () => ({
        getAppConfig: mock(() => Promise.resolve({ cronSecret: "test-secret" })),
      }));

      const { POST } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/cron", {
        method: "POST",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
