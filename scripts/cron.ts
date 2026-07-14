/**
 * Local cron job for running the trading bot at UTC midnight.
 *
 * This script can be run as a standalone process that will execute
 * the trading bot at midnight UTC every day.
 *
 * Usage:
 *   bun run scripts/cron.ts
 *
 * For production, consider using:
 * - Vercel Cron Jobs (if deployed on Vercel)
 * - Railway scheduled jobs
 * - A dedicated cron service
 * - PM2 with cron
 */

import cron from "node-cron";
import { config } from "dotenv";

// Load environment variables
config();

const API_URL = process.env.API_URL || "http://localhost:3001";
const CRON_SECRET = process.env.CRON_SECRET;

async function waitForApi(maxAttempts = 30, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (response.ok) {
        console.log(`[${new Date().toISOString()}] API is ready`);
        return true;
      }
    } catch {
      console.log(`[${new Date().toISOString()}] Waiting for API... (${i}/${maxAttempts})`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error(`[${new Date().toISOString()}] API did not become ready`);
  return false;
}

async function runBot() {
  console.log(`[${new Date().toISOString()}] Running trading bot...`);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (CRON_SECRET) {
      headers["Authorization"] = `Bearer ${CRON_SECRET}`;
    }

    const response = await fetch(`${API_URL}/api/cron`, {
      method: "GET",
      headers,
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`[${new Date().toISOString()}] Bot run completed:`, result);
    } else {
      console.error(`[${new Date().toISOString()}] Bot run failed:`, result);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running bot:`, error);
  }
}

// Schedule cron job for midnight UTC every day
// Cron format: minute hour day month dayOfWeek
const cronExpression = process.env.CRON_EXPRESSION || "0 0,12 * * *";
cron.schedule(
  cronExpression,
  () => {
    runBot();
  },
  {
    timezone: "UTC",
  }
);

waitForApi().then((ready) => {
  if (ready && process.env.TEST_MODE === "true") {
    console.log("Running bot in test mode...");
    runBot();
  }
});

console.log(`[${new Date().toISOString()}] Cron job scheduled for UTC midnight`);
console.log(`API URL: ${API_URL}`);
console.log("CRON_SECRET:", CRON_SECRET ? "[set]" : "[missing]");
console.log("CRON_EXPRESSION:", cronExpression);
console.log("TEST_MODE:", process.env.TEST_MODE);
console.log("Press Ctrl+C to stop\n");

// Keep the process running
process.on("SIGINT", () => {
  console.log("\nStopping cron job...");
  process.exit(0);
});

