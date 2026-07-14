import { NextResponse } from "next/server";
import {
  checkConfigurationStalenessAsync,
  MULTIPLIER_TYPE_LABELS,
  StaleConfig,
} from "@/lib/configuration-staleness";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ symbol: "staleness" });

interface StaleConfigurationResponse {
  type: StaleConfig["type"];
  label: string;
  updatedAt?: string;
  weeksStale: number;
}

interface ConfigurationStalenessData {
  level: "warning" | "danger" | null;
  staleConfigs: StaleConfigurationResponse[];
}

export async function GET(): Promise<NextResponse<ConfigurationStalenessData>> {
  try {
    const result = await checkConfigurationStalenessAsync();

    const staleConfigs: StaleConfigurationResponse[] = result.staleConfigs.map(
      (config) => ({
        type: config.type,
        label: MULTIPLIER_TYPE_LABELS[config.type],
        weeksStale: config.weeksStale,
      })
    );

    const level = result.alertLevel === "none" ? null : result.alertLevel;

    return NextResponse.json({ level, staleConfigs });
  } catch (error) {
    logger.error("Failed to check configuration staleness", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ level: null, staleConfigs: [] });
  }
}
