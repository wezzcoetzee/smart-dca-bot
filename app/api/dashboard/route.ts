import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import prisma from "@/lib/db";
import { getCurrentPrice } from "@/lib/hyperliquid";
import { createLogger } from "@/lib/logger";
import {
  subtractMonthsUTC,
  subtractYearsUTC,
} from "@/lib/date";
import type {
  Period,
  DashboardResponse,
  ChartDataPoint,
  TransactionRow,
} from "@/types/dashboard";

const logger = createLogger({ symbol: "dashboard" });

function getDateRangeForPeriod(period: Period): { from: Date; to: Date } {
  const to = new Date();
  let from: Date;

  switch (period) {
    case "1m":
      from = subtractMonthsUTC(to, 1);
      break;
    case "1y":
      from = subtractYearsUTC(to, 1);
      break;
    case "all":
      from = new Date(0);
      break;
    default:
      from = subtractMonthsUTC(to, 1);
  }

  return { from, to };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") as Period) || "1m";
    const appConfig = await getAppConfig();

    const { from, to } = getDateRangeForPeriod(period);

    const [transactions, currentPrice] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          date: {
            gte: from,
            lte: to,
          },
        },
        orderBy: { date: "asc" },
      }),
      getCurrentPrice(appConfig.hyperliquidSymbol),
    ]);

    let cumulativeProgramaticBtc = 0;
    let cumulativeFixedBtc = 0;
    let cumulativeProgramaticSpent = 0;
    let cumulativeFixedSpent = 0;

    const chartData: ChartDataPoint[] = [];
    const programaticTransactions: TransactionRow[] = [];

    for (const tx of transactions) {
      const txSpent = tx.amount * tx.price;
      if (tx.dcaType === "PROGRAMATIC") {
        cumulativeProgramaticBtc += tx.amount;
        cumulativeProgramaticSpent += txSpent;
        programaticTransactions.push({
          id: tx.id,
          date: tx.date.toISOString(),
          amount: tx.amount,
          price: tx.price,
          reason: tx.reason,
        });
      } else {
        cumulativeFixedBtc += tx.amount;
        cumulativeFixedSpent += txSpent;
      }

      chartData.push({
        date: tx.date.toISOString().split("T")[0],
        programaticValue: cumulativeProgramaticBtc * tx.price,
        fixedValue: cumulativeFixedBtc * tx.price,
        btcPrice: tx.price,
        programaticBtcAccumulated: cumulativeProgramaticBtc,
        fixedBtcAccumulated: cumulativeFixedBtc,
        programaticSpent: cumulativeProgramaticSpent,
        fixedSpent: cumulativeFixedSpent,
      });
    }

    programaticTransactions.reverse();

    const totalProgramaticBtc = cumulativeProgramaticBtc;
    const totalFixedBtc = cumulativeFixedBtc;

    const totalProgramaticValue = totalProgramaticBtc * currentPrice;
    const totalFixedValue = totalFixedBtc * currentPrice;

    const percentageDifference =
      totalFixedValue > 0
        ? ((totalProgramaticValue - totalFixedValue) / totalFixedValue) * 100
        : 0;

    const response: DashboardResponse = {
      chartData,
      transactions: programaticTransactions,
      summary: {
        currentPrice,
        totalProgramaticValue,
        totalFixedValue,
        programaticBtcAmount: totalProgramaticBtc,
        fixedBtcAmount: totalFixedBtc,
        percentageDifference,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Dashboard API error", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
