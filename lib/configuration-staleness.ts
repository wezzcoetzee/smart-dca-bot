import prisma from "@/lib/db";
import { MultiplierType } from "@/generated/prisma/enums";
import { getAppConfig, type AppConfig } from "./app-config";
import {
  MULTIPLIER_TYPE_LABELS,
  MS_PER_WEEK,
  getStalenessLevel,
} from "./configuration-staleness-constants";

export interface StaleConfig {
  type: MultiplierType;
  label: string;
  weeksStale: number;
}

export interface StalenessResult {
  staleConfigs: StaleConfig[];
  alertLevel: "none" | "warning" | "danger";
}

export { MULTIPLIER_TYPE_LABELS, MS_PER_WEEK, getStalenessLevel };

export async function checkConfigurationStalenessAsync(appConfig?: AppConfig): Promise<StalenessResult> {
  const config = appConfig ?? (await getAppConfig());
  const warningWeeks = config.configWarningWeeks;
  const dangerWeeks = config.configDangerWeeks;

  const configs = await prisma.multiplierConfiguration.findMany({
    where: {
      type: { not: MultiplierType.MOVING_AVERAGE },
      enabled: true,
    },
    select: {
      type: true,
      updatedAt: true,
    },
  });

  const now = Date.now();
  const staleConfigs: StaleConfig[] = [];
  let hasDanger = false;

  for (const config of configs) {
    const weeksStale = Math.floor(
      (now - config.updatedAt.getTime()) / MS_PER_WEEK
    );

    if (weeksStale >= warningWeeks) {
      staleConfigs.push({
        type: config.type,
        label: MULTIPLIER_TYPE_LABELS[config.type],
        weeksStale,
      });

      if (weeksStale >= dangerWeeks) {
        hasDanger = true;
      }
    }
  }

  const alertLevel: StalenessResult["alertLevel"] =
    staleConfigs.length === 0 ? "none" : hasDanger ? "danger" : "warning";

  return { staleConfigs, alertLevel };
}
