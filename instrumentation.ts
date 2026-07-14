import { info } from "@/lib/logger";

const ENV_KEYS = [
  "DATABASE_URL",
  "DB_ENCRYPTION_KEY",
  "CRON_EXPRESSION",
  "TEST_MODE",
  "API_URL",
  "CRON_SECRET",
  "LOG_LEVEL",
  "ENABLE_LOGS",
] as const;

const SENSITIVE_KEYS = new Set(["DATABASE_URL", "DB_ENCRYPTION_KEY", "CRON_SECRET"]);

function maskValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.has(key)) {
    return value.length > 4 ? `${value.slice(0, 4)}****` : "****";
  }
  return value;
}

export function register(): void {
  const envStatus = ENV_KEYS.map((key) => {
    const value = process.env[key];
    if (!value) return `  ${key}: (not set)`;
    return `  ${key}: ${maskValue(key, value)}`;
  }).join("\n");

  info(`Environment variables:\n${envStatus}`, { symbol: "startup" });
}
