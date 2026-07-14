import { MultiplierType } from "@/generated/prisma/enums";

export const MULTIPLIER_TYPE_LABELS: Record<MultiplierType, string> = {
  MOVING_AVERAGE: "Moving Average",
  LTH_REALIZED_PRICE: "LTH Realized Price",
  AVERAGE_REALIZED_PRICE: "Average Realized Price",
  LTH_BUYING: "LTH Buying",
};

export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function getStalenessLevel(
  updatedAt: string,
  type: MultiplierType,
  warningWeeks: number,
  dangerWeeks: number
): "warning" | "danger" | null {
  if (type === MultiplierType.MOVING_AVERAGE) return null;
  const weeksStale = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / MS_PER_WEEK
  );
  if (weeksStale >= dangerWeeks) return "danger";
  if (weeksStale >= warningWeeks) return "warning";
  return null;
}
