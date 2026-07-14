import prisma from "./db";

const DEFAULT_CONFIG_ID = "default" as const;

function buildUpdateData<T extends Record<string, unknown>>(config: Partial<T>): Partial<T> {
  return Object.entries(config).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof T] = value as T[keyof T];
    }
    return acc;
  }, {} as Partial<T>);
}

export interface AppConfig {
  baseAmountToPurchase: number;
  hyperliquidSymbol: string;
  lowBalanceThreshold: number;
  cronSecret: string;
  discordWebhookUrl: string;
  discordEnabled: boolean;
  configWarningWeeks: number;
  configDangerWeeks: number;
  hyperliquidPrivateKey: string;
  hyperliquidWalletAddress: string;
  hyperliquidKeyCreatedDate: Date | null;
}

export async function getAppConfig(): Promise<AppConfig> {
  const config = await prisma.appConfiguration.findUniqueOrThrow({
    where: { id: DEFAULT_CONFIG_ID },
  });
  return config;
}

export async function updateAppConfig(config: Partial<AppConfig>): Promise<void> {
  await prisma.appConfiguration.upsert({
    where: { id: DEFAULT_CONFIG_ID },
    create: {
      id: DEFAULT_CONFIG_ID,
      ...config,
    },
    update: buildUpdateData(config),
  });
}
