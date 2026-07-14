import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { NextRequest } from "next/server";
import { MultiplierType } from "@/generated/prisma/enums";

interface OrderByParam {
  type?: string;
}

interface FindManyParams {
  orderBy?: OrderByParam;
}

interface MultiplierConfigData {
  type: MultiplierType;
  value: string;
  multiplier: number;
  enabled: boolean;
}

interface UpsertParams {
  where: { type: MultiplierType };
  create: MultiplierConfigData;
  update: Partial<MultiplierConfigData>;
}

describe("api/multiplier-configuration/route", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  describe("GET", () => {
    test("returns all multiplier configurations", async () => {
      const mockConfigs = [
        {
          id: 1,
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
          enabled: true,
        },
        {
          id: 2,
          type: MultiplierType.MOVING_AVERAGE,
          value: "200",
          multiplier: 1.5,
          enabled: true,
        },
      ];

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve(mockConfigs)),
          },
        },
      }));

      const { GET } = await import("./route");
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConfigs);
      expect(data.length).toBe(2);
    });

    test("orders results by type ascending", async () => {
      let orderByParam: OrderByParam | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock((params: FindManyParams) => {
              orderByParam = params.orderBy;
              return Promise.resolve([]);
            }),
          },
        },
      }));

      const { GET } = await import("./route");
      await GET();

      expect(orderByParam).toEqual({ type: "asc" });
    });

    test("returns empty array when no configs exist", async () => {
      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.resolve([])),
          },
        },
      }));

      const { GET } = await import("./route");
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    test("returns 500 on database error", async () => {
      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            findMany: mock(() => Promise.reject(new Error("Database error"))),
          },
        },
      }));

      const { GET } = await import("./route");
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch configurations");
    });
  });

  describe("PATCH", () => {
    test("updates existing configuration", async () => {
      const updatedConfig = {
        id: 1,
        type: MultiplierType.LTH_REALIZED_PRICE,
        value: "65000",
        multiplier: 2.5,
        enabled: true,
      };

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock(() => Promise.resolve(updatedConfig)),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "65000",
          multiplier: 2.5,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.value).toBe("65000");
      expect(data.multiplier).toBe(2.5);
    });

    test("creates new configuration when not exists", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({
                id: 1,
                type: MultiplierType.LTH_BUYING,
                value: "true",
                multiplier: 1.5,
                enabled: true,
              });
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_BUYING,
          value: "true",
          multiplier: 1.5,
        }),
      });
      await PATCH(request);

      expect(upsertParams.create.type).toBe(MultiplierType.LTH_BUYING);
      expect(upsertParams.create.enabled).toBe(true);
    });

    test("returns 400 when type is missing", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          value: "60000",
          multiplier: 2,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("returns 400 when value is missing", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          multiplier: 2,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("returns 400 when multiplier is missing", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("returns 400 when multiplier is not a number", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: "not-a-number",
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("returns 400 when multiplier is NaN", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: NaN,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("updates enabled field when provided", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({});
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
          enabled: false,
        }),
      });
      await PATCH(request);

      expect(upsertParams.update.enabled).toBe(false);
    });

    test("does not update enabled field when not provided", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({});
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
        }),
      });
      await PATCH(request);

      expect(upsertParams.update.enabled).toBeUndefined();
    });

    test("sets enabled to true by default on create", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({});
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
        }),
      });
      await PATCH(request);

      expect(upsertParams.create.enabled).toBe(true);
    });

    test("respects enabled=false on create", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({});
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
          enabled: false,
        }),
      });
      await PATCH(request);

      expect(upsertParams.create.enabled).toBe(false);
    });

    test("uses type as unique identifier", async () => {
      let upsertParams: UpsertParams | null = null;

      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock((params: UpsertParams) => {
              upsertParams = params;
              return Promise.resolve({});
            }),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.MOVING_AVERAGE,
          value: "200",
          multiplier: 1.5,
        }),
      });
      await PATCH(request);

      expect(upsertParams.where.type).toBe(MultiplierType.MOVING_AVERAGE);
    });

    test("returns 500 on database error", async () => {
      mock.module("@/lib/db", () => ({
        default: {
          multiplierConfiguration: {
            upsert: mock(() => Promise.reject(new Error("Database error"))),
          },
        },
      }));

      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 2,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update configuration");
    });

    test("rejects zero as invalid multiplier", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: 0,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });

    test("rejects negative multipliers", async () => {
      const { PATCH } = await import("./route");
      const request = new NextRequest("http://localhost:3001/api/multiplier-configuration", {
        method: "PATCH",
        body: JSON.stringify({
          type: MultiplierType.LTH_REALIZED_PRICE,
          value: "60000",
          multiplier: -1,
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request data");
    });
  });
});
