import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { MultiplierType } from "@/generated/prisma/enums";

const logger = createLogger({ symbol: "config" });

const updateSchema = z.object({
  type: z.nativeEnum(MultiplierType),
  value: z.string().min(1),
  multiplier: z.number().finite().gte(0.1).lte(20),
  enabled: z.boolean().optional(),
}).superRefine((data, ctx) => {
  switch (data.type) {
    case MultiplierType.LTH_BUYING:
      if (data.value !== "true" && data.value !== "false") {
        ctx.addIssue({ code: "custom", path: ["value"], message: 'LTH_BUYING value must be "true" or "false"' });
      }
      break;
    case MultiplierType.MOVING_AVERAGE: {
      const days = Number(data.value);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "MOVING_AVERAGE value must be an integer between 1 and 365" });
      }
      break;
    }
    case MultiplierType.LTH_REALIZED_PRICE:
    case MultiplierType.AVERAGE_REALIZED_PRICE: {
      const price = Number(data.value);
      if (!Number.isFinite(price) || price <= 0) {
        ctx.addIssue({ code: "custom", path: ["value"], message: `${data.type} value must be a positive number` });
      }
      break;
    }
  }
});

export async function GET(): Promise<NextResponse> {
  try {
    const configs = await prisma.multiplierConfiguration.findMany({
      orderBy: { type: "asc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    logger.error("Failed to fetch multiplier configurations", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to fetch configurations" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const json = await request.json();
    const body = updateSchema.parse(json);

    const updated = await prisma.multiplierConfiguration.upsert({
      where: { type: body.type },
      update: {
        value: body.value,
        multiplier: body.multiplier,
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
      create: {
        type: body.type,
        value: body.value,
        multiplier: body.multiplier,
        enabled: body.enabled ?? true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Failed to update multiplier configuration", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
