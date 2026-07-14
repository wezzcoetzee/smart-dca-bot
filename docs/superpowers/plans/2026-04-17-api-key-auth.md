# API Key Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mnemonic-based wallet auth with DB-stored, AES-256-encrypted Hyperliquid API wallet keys, with 7-day expiry warnings.

**Architecture:** Credentials move from env vars to the `AppConfiguration` DB table, encrypted at rest. `HyperliquidBot` accepts credentials via constructor instead of reading `process.env`. A new encryption module handles AES-256-GCM. The strategy checks key expiry before each execution and warns via the notification system.

**Tech Stack:** viem (`privateKeyToAccount`), Node.js `crypto` (AES-256-GCM), Prisma, Next.js App Router, Bun test runner.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/encryption.ts` | AES-256-GCM encrypt/decrypt |
| Create | `lib/encryption.test.ts` | Encryption round-trip tests |
| Create | `lib/key-expiry.ts` | Key expiry calculation and warning |
| Create | `lib/key-expiry.test.ts` | Expiry logic tests |
| Create | `app/settings/hyperliquid/page.tsx` | Settings UI for API key credentials |
| Modify | `prisma/schema.prisma` | Add 3 fields to AppConfiguration |
| Modify | `lib/hyperliquid-bot.ts` | Constructor accepts params, use `privateKeyToAccount` |
| Modify | `lib/hyperliquid-bot.test.ts` | Update for new constructor API |
| Modify | `lib/app-config.ts` | Add new fields to AppConfig interface, decrypt private key on read |
| Modify | `lib/strategy.ts` | Pass credentials to bot, check expiry |
| Modify | `app/api/wallet-balance/route.ts` | Pass credentials to bot |
| Modify | `app/api/app-configuration/route.ts` | Encrypt private key on write, mask on read |
| Modify | `app/settings/_components/shared.tsx` | Extend AppConfig interface with new fields |
| Modify | `instrumentation.ts` | Replace MNEMONIC with DB_ENCRYPTION_KEY |
| Modify | `.env.example` | Remove MNEMONIC, add DB_ENCRYPTION_KEY |
| Modify | `.github/workflows/deploy.yml` | Replace DCA_MNEMONIC secret with DB_ENCRYPTION_KEY |
| Modify | `lib/integration.test.ts` | Update env/mock references |
| Modify | `README.md` | Update setup instructions |
| Modify | `docs/SECURITY.md` | Update key handling docs |
| Modify | `ARCHITECTURE.md` | Update references |

---

### Task 1: Encryption Module

**Files:**
- Create: `lib/encryption.ts`
- Create: `lib/encryption.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/encryption.test.ts
import { describe, test, expect } from "bun:test";
import { encrypt, decrypt } from "./encryption";

const TEST_KEY = "a".repeat(64); // 32 bytes hex

describe("encryption", () => {
  describe("encrypt/decrypt round-trip", () => {
    test("returns original plaintext after encrypt then decrypt", () => {
      // #given
      const plaintext = "0xabc123privatekey";

      // #when
      const ciphertext = encrypt(plaintext, TEST_KEY);
      const result = decrypt(ciphertext, TEST_KEY);

      // #then
      expect(result).toBe(plaintext);
    });
  });

  describe("encrypt", () => {
    test("produces different ciphertext each time due to random IV", () => {
      // #given
      const plaintext = "0xabc123privatekey";

      // #when
      const a = encrypt(plaintext, TEST_KEY);
      const b = encrypt(plaintext, TEST_KEY);

      // #then
      expect(a).not.toBe(b);
    });

    test("returns empty string for empty input", () => {
      // #given / #when
      const result = encrypt("", TEST_KEY);

      // #then
      expect(result).toBe("");
    });
  });

  describe("decrypt", () => {
    test("returns empty string for empty input", () => {
      // #given / #when
      const result = decrypt("", TEST_KEY);

      // #then
      expect(result).toBe("");
    });

    test("throws with wrong key", () => {
      // #given
      const ciphertext = encrypt("secret", TEST_KEY);
      const wrongKey = "b".repeat(64);

      // #when / #then
      expect(() => decrypt(ciphertext, wrongKey)).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test lib/encryption.test.ts`
Expected: FAIL — `encrypt` and `decrypt` not found.

- [ ] **Step 3: Implement encryption module**

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string, hexKey: string): string {
  if (!plaintext) return "";

  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string, hexKey: string): string {
  if (!ciphertext) return "";

  const key = Buffer.from(hexKey, "hex");
  const data = Buffer.from(ciphertext, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test lib/encryption.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/encryption.ts lib/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption module"
```

---

### Task 2: Key Expiry Module

**Files:**
- Create: `lib/key-expiry.ts`
- Create: `lib/key-expiry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/key-expiry.test.ts
import { describe, test, expect } from "bun:test";
import { getDaysUntilExpiry, shouldWarnExpiry, EXPIRY_DAYS, WARNING_THRESHOLD_DAYS } from "./key-expiry";

describe("key-expiry", () => {
  describe("getDaysUntilExpiry", () => {
    test("returns 180 for a key created today", () => {
      // #given
      const today = new Date();

      // #when
      const result = getDaysUntilExpiry(today);

      // #then
      expect(result).toBe(180);
    });

    test("returns 0 for a key created 180 days ago", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 180);

      // #when
      const result = getDaysUntilExpiry(created);

      // #then
      expect(result).toBe(0);
    });

    test("returns negative for an expired key", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 200);

      // #when
      const result = getDaysUntilExpiry(created);

      // #then
      expect(result).toBe(-20);
    });

    test("returns 173 for a key created 7 days ago", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 7);

      // #when
      const result = getDaysUntilExpiry(created);

      // #then
      expect(result).toBe(173);
    });
  });

  describe("shouldWarnExpiry", () => {
    test("returns false when 173 days remaining", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 7);

      // #when / #then
      expect(shouldWarnExpiry(created)).toBe(false);
    });

    test("returns true when exactly 7 days remaining", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 173);

      // #when / #then
      expect(shouldWarnExpiry(created)).toBe(true);
    });

    test("returns true when 0 days remaining", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 180);

      // #when / #then
      expect(shouldWarnExpiry(created)).toBe(true);
    });

    test("returns true when key is expired", () => {
      // #given
      const created = new Date();
      created.setDate(created.getDate() - 200);

      // #when / #then
      expect(shouldWarnExpiry(created)).toBe(true);
    });
  });

  test("constants are correct", () => {
    expect(EXPIRY_DAYS).toBe(180);
    expect(WARNING_THRESHOLD_DAYS).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test lib/key-expiry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement key expiry module**

```typescript
// lib/key-expiry.ts
export const EXPIRY_DAYS = 180;
export const WARNING_THRESHOLD_DAYS = 7;

export function getDaysUntilExpiry(keyCreatedDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - keyCreatedDate.getTime();
  const daysSinceCreation = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return EXPIRY_DAYS - daysSinceCreation;
}

export function shouldWarnExpiry(keyCreatedDate: Date): boolean {
  return getDaysUntilExpiry(keyCreatedDate) <= WARNING_THRESHOLD_DAYS;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test lib/key-expiry.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/key-expiry.ts lib/key-expiry.test.ts
git commit -m "feat: add API key expiry calculation module"
```

---

### Task 3: Database Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to AppConfiguration model**

In `prisma/schema.prisma`, add these three fields to the `AppConfiguration` model, after the `discordEnabled` field:

```prisma
  hyperliquidPrivateKey    String    @default("") @map("hyperliquid_private_key")
  hyperliquidWalletAddress String    @default("") @map("hyperliquid_wallet_address")
  hyperliquidKeyCreatedDate DateTime? @map("hyperliquid_key_created_date")
```

- [ ] **Step 2: Generate and run migration**

Run: `bunx prisma migrate dev --name add-hyperliquid-api-key-fields`
Expected: Migration created and applied successfully.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Hyperliquid API key fields to AppConfiguration"
```

---

### Task 4: Update AppConfig Interface and Resolution

**Files:**
- Modify: `lib/app-config.ts`
- Modify: `app/settings/_components/shared.tsx`

- [ ] **Step 1: Update the AppConfig interface in `lib/app-config.ts`**

Add the three new fields to the `AppConfig` interface (after `configDangerWeeks`):

```typescript
  hyperliquidPrivateKey: string;
  hyperliquidWalletAddress: string;
  hyperliquidKeyCreatedDate: Date | null;
```

- [ ] **Step 2: Update the AppConfig interface in `app/settings/_components/shared.tsx`**

Add the same three fields to the duplicate `AppConfig` interface:

```typescript
  hyperliquidPrivateKey: string;
  hyperliquidWalletAddress: string;
  hyperliquidKeyCreatedDate: string | null;
```

Note: `Date` becomes `string | null` here because this is the client-side type (JSON-serialized).

- [ ] **Step 3: Commit**

```bash
git add lib/app-config.ts app/settings/_components/shared.tsx
git commit -m "feat: add Hyperliquid API key fields to AppConfig interface"
```

---

### Task 5: Encrypt on Write, Mask on Read in API Route

**Files:**
- Modify: `app/api/app-configuration/route.ts`

- [ ] **Step 1: Update the GET handler to mask the private key**

Replace the GET handler body to mask the private key before returning:

```typescript
export async function GET(): Promise<NextResponse<ApiResponse<AppConfig>>> {
  try {
    const config = await getAppConfig();
    const masked = {
      ...config,
      hyperliquidPrivateKey: config.hyperliquidPrivateKey ? "••••••••" : "",
    };
    return NextResponse.json({ success: true, data: masked });
  } catch (error) {
    logger.error("Failed to get app configuration", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Failed to get configuration" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Update the PUT handler to encrypt the private key**

Replace the PUT handler body to encrypt the private key if it changed (skip if masked placeholder):

```typescript
import { encrypt } from "@/lib/encryption";

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const body = await request.json();

    if (body.hyperliquidPrivateKey && body.hyperliquidPrivateKey !== "••••••••") {
      const encryptionKey = process.env.DB_ENCRYPTION_KEY;
      if (!encryptionKey) {
        return NextResponse.json(
          { success: false, error: "DB_ENCRYPTION_KEY not configured" },
          { status: 500 }
        );
      }
      body.hyperliquidPrivateKey = encrypt(body.hyperliquidPrivateKey, encryptionKey);
    } else {
      delete body.hyperliquidPrivateKey;
    }

    if (body.hyperliquidKeyCreatedDate) {
      body.hyperliquidKeyCreatedDate = new Date(body.hyperliquidKeyCreatedDate);
    }

    await updateAppConfig(body);
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    logger.error("Failed to update app configuration", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/app-configuration/route.ts
git commit -m "feat: encrypt API key on write, mask on read"
```

---

### Task 6: Update HyperliquidBot Constructor

**Files:**
- Modify: `lib/hyperliquid-bot.ts`
- Modify: `lib/hyperliquid-bot.test.ts`

- [ ] **Step 1: Write failing tests for new constructor**

Replace the contents of `lib/hyperliquid-bot.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { HyperliquidBot } from "./hyperliquid-bot";

describe("HyperliquidBot", () => {
  const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const TEST_WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  describe("constructor", () => {
    test("sets address to provided wallet address", () => {
      // #given / #when
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #then
      expect(bot.address).toBe(TEST_WALLET_ADDRESS);
    });

    test("throws when private key is empty", () => {
      // #when / #then
      expect(() => new HyperliquidBot("", TEST_WALLET_ADDRESS)).toThrow("Hyperliquid private key not configured");
    });

    test("throws when wallet address is empty", () => {
      // #when / #then
      expect(() => new HyperliquidBot(TEST_PRIVATE_KEY, "")).toThrow("Hyperliquid wallet address not configured");
    });
  });

  describe("isLowBalance", () => {
    test("returns true when balance is below threshold", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when
      const result = bot.isLowBalance(50, 100);

      // #then
      expect(result).toBe(true);
    });

    test("returns false when balance is above threshold", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when
      const result = bot.isLowBalance(150, 100);

      // #then
      expect(result).toBe(false);
    });

    test("returns false when balance equals threshold", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when
      const result = bot.isLowBalance(100, 100);

      // #then
      expect(result).toBe(false);
    });
  });

  describe("getBalances", () => {
    test("method exists on bot instance", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #then
      expect(typeof bot.getBalances).toBe("function");
    });
  });

  describe("buy", () => {
    test("method exists on bot instance", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #then
      expect(typeof bot.buy).toBe("function");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test lib/hyperliquid-bot.test.ts`
Expected: FAIL — constructor signature mismatch.

- [ ] **Step 3: Update HyperliquidBot implementation**

Replace `lib/hyperliquid-bot.ts`:

```typescript
import { privateKeyToAccount } from "viem/accounts";
import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { createLogger } from "./logger";

const logger = createLogger({ symbol: "hyperliquid-bot" });

export interface SpotBalances {
  usdc: number;
  btc: number;
}

export interface BuyResult {
  filledQty: number;
  avgPrice: number;
  orderId: number;
}

export class HyperliquidBot {
  readonly address: string;
  private exchange: ExchangeClient;
  private info: InfoClient;

  constructor(privateKey: string, walletAddress: string) {
    if (!privateKey) {
      throw new Error("Hyperliquid private key not configured");
    }
    if (!walletAddress) {
      throw new Error("Hyperliquid wallet address not configured");
    }

    this.address = walletAddress;

    const wallet = privateKeyToAccount(privateKey as `0x${string}`);
    const transport = new HttpTransport();
    this.info = new InfoClient({ transport });
    this.exchange = new ExchangeClient({ wallet, transport });

    logger.info("HyperliquidBot initialized");
  }

  async getBalances(): Promise<SpotBalances> {
    const state = await this.info.spotClearinghouseState({ user: this.address });

    let usdc = 0;
    let btc = 0;

    for (const balance of state.balances) {
      if (balance.coin === "USDC") {
        usdc = parseFloat(balance.total);
      } else if (balance.coin === "BTC") {
        btc = parseFloat(balance.total);
      }
    }

    return { usdc, btc };
  }

  isLowBalance(usdcBalance: number, threshold: number): boolean {
    return usdcBalance < threshold;
  }

  async buy(usdAmount: number, currentPrice: number): Promise<BuyResult> {
    const spotMeta = await this.info.spotMeta();

    const btcUniverse = spotMeta.universe.find(
      (pair) => pair.name === "BTC/USDC" || pair.tokens[0] !== undefined && spotMeta.tokens[pair.tokens[0]]?.name === "BTC"
    );

    if (!btcUniverse) {
      throw new Error("BTC/USDC pair not found in spot universe");
    }

    const spotAssetIndex = 10000 + btcUniverse.index;
    const btcToken = spotMeta.tokens[btcUniverse.tokens[0]];
    const szDecimals = btcToken.szDecimals;

    const size = usdAmount / currentPrice;
    const roundedSize = parseFloat(size.toFixed(szDecimals));
    const limitPrice = (currentPrice * 1.005).toFixed(2);

    const result = await this.exchange.order({
      orders: [{
        a: spotAssetIndex,
        b: true,
        p: limitPrice,
        s: roundedSize.toString(),
        r: false,
        t: { limit: { tif: "Ioc" } },
      }],
      grouping: "na",
    });

    const status = result.response.data.statuses[0];

    if (typeof status === "object" && "filled" in status) {
      return {
        filledQty: parseFloat(status.filled.totalSz),
        avgPrice: parseFloat(status.filled.avgPx),
        orderId: status.filled.oid,
      };
    }

    if (typeof status === "object" && "resting" in status) {
      throw new Error("IOC order unexpectedly resting");
    }

    if (typeof status === "object" && "error" in status) {
      throw new Error(`Order failed: ${(status as { error: string }).error}`);
    }

    throw new Error(`Unexpected order status: ${JSON.stringify(status)}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test lib/hyperliquid-bot.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hyperliquid-bot.ts lib/hyperliquid-bot.test.ts
git commit -m "feat: replace mnemonic with private key constructor params"
```

---

### Task 7: Update Strategy to Pass Credentials and Check Expiry

**Files:**
- Modify: `lib/strategy.ts`

- [ ] **Step 1: Update `initializeStrategyContext` to read credentials from DB and create bot**

Replace the `initializeStrategyContext` function and add the expiry check. Add imports at the top:

```typescript
import { decrypt } from "./encryption";
import { shouldWarnExpiry, getDaysUntilExpiry } from "./key-expiry";
```

Replace `initializeStrategyContext`:

```typescript
async function initializeStrategyContext(): Promise<StrategyContext> {
    const appConfig = await getAppConfig();

    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (!encryptionKey) {
        throw new Error("DB_ENCRYPTION_KEY not configured");
    }

    const privateKey = decrypt(appConfig.hyperliquidPrivateKey, encryptionKey);
    const bot = new HyperliquidBot(privateKey, appConfig.hyperliquidWalletAddress);

    if (appConfig.hyperliquidKeyCreatedDate) {
        if (shouldWarnExpiry(appConfig.hyperliquidKeyCreatedDate)) {
            const daysLeft = getDaysUntilExpiry(appConfig.hyperliquidKeyCreatedDate);
            const msg = daysLeft <= 0
                ? `Hyperliquid API key has expired. Generate a new key at https://app.hyperliquid.xyz/API`
                : `Hyperliquid API key expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Generate a new key at https://app.hyperliquid.xyz/API`;
            logger.warn(msg);
            await sendNotification(`\u26A0\uFE0F ${msg}`);
        }
    }

    const btcPrice = await getCurrentPrice(appConfig.hyperliquidSymbol);

    dcaBtcPriceUsd.set(btcPrice);
    logger.info(`Current ${appConfig.hyperliquidSymbol} price: $${btcPrice.toLocaleString()}`);

    return { appConfig, bot, btcPrice };
}
```

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: Existing integration tests will fail because `HyperliquidBot` constructor changed — that's expected and fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add lib/strategy.ts
git commit -m "feat: pass DB credentials to bot, add expiry warning"
```

---

### Task 8: Update Wallet Balance API Route

**Files:**
- Modify: `app/api/wallet-balance/route.ts`

- [ ] **Step 1: Update the route to read credentials from DB**

Replace the route handler to read credentials from the DB and pass to the bot:

```typescript
import { NextResponse } from "next/server";
import { HyperliquidBot } from "@/lib/hyperliquid-bot";
import { getAppConfig } from "@/lib/app-config";
import { decrypt } from "@/lib/encryption";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ symbol: "wallet-balance" });

export async function GET() {
  try {
    const appConfig = await getAppConfig();
    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json({ error: "DB_ENCRYPTION_KEY not configured" }, { status: 500 });
    }

    const privateKey = decrypt(appConfig.hyperliquidPrivateKey, encryptionKey);
    const bot = new HyperliquidBot(privateKey, appConfig.hyperliquidWalletAddress);
    const balances = await bot.getBalances();

    return NextResponse.json({
      address: bot.address,
      balances: {
        btc: {
          amount: balances.btc,
        },
        usdc: {
          amount: balances.usdc,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to fetch balances", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/wallet-balance/route.ts
git commit -m "feat: wallet-balance route reads credentials from DB"
```

---

### Task 9: Update Integration Tests

**Files:**
- Modify: `lib/integration.test.ts`

- [ ] **Step 1: Read the current integration test file**

Read `lib/integration.test.ts` in full to understand all MNEMONIC references and HyperliquidBot mock patterns.

- [ ] **Step 2: Update env setup and mocks**

In `beforeEach`:
- Replace `process.env.MNEMONIC = "..."` with `process.env.DB_ENCRYPTION_KEY = "a".repeat(64)`
- Update any `HyperliquidBot` mock to match the new constructor signature `(privateKey: string, walletAddress: string)`

In the mock for `lib/app-config.ts` (or wherever `getAppConfig` is mocked), include the three new fields:
```typescript
hyperliquidPrivateKey: "encrypted-value",
hyperliquidWalletAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
hyperliquidKeyCreatedDate: new Date(),
```

Also mock `lib/encryption.ts` so `decrypt` returns a test private key:
```typescript
mock.module("./encryption", () => ({
  encrypt: (v: string) => v,
  decrypt: () => "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
}));
```

- [ ] **Step 3: Run tests**

Run: `bun test lib/integration.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/integration.test.ts
git commit -m "test: update integration tests for API key auth"
```

---

### Task 10: Settings UI — Hyperliquid Page

**Files:**
- Create: `app/settings/hyperliquid/page.tsx`

- [ ] **Step 1: Create the Hyperliquid settings page**

Follow the same pattern as `app/settings/schedule/page.tsx`. Create `app/settings/hyperliquid/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppConfig, ConfigField, SaveFooter } from "../_components/shared";

export default function HyperliquidPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch("/api/app-configuration");
        if (!response.ok) throw new Error("Failed to fetch configuration");
        const result = await response.json();
        if (result.success) {
          setConfig(result.data);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to fetch config:", error);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleChange = (name: keyof AppConfig, value: string | number) => {
    if (!config) return;
    setConfig({ ...config, [name]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);

    try {
      const response = await fetch("/api/app-configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hyperliquidPrivateKey: config.hyperliquidPrivateKey,
          hyperliquidWalletAddress: config.hyperliquidWalletAddress,
          hyperliquidKeyCreatedDate: config.hyperliquidKeyCreatedDate,
        }),
      });

      if (!response.ok) throw new Error("Failed to save configuration");
      toast.success("Hyperliquid configuration saved");
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-[#666666] text-[14px] tracking-[-0.01em]">Loading...</div>;
  }

  if (!config) {
    return <div className="text-[#DC2626] text-[14px] tracking-[-0.01em]">Failed to load configuration</div>;
  }

  return (
    <div>
      <h2 className="text-[18px] font-normal text-white tracking-[-0.01em] mb-8">
        Hyperliquid
      </h2>

      <div className="space-y-8">
        <ConfigField
          label="API Private Key"
          name="hyperliquidPrivateKey"
          value={config.hyperliquidPrivateKey}
          onChange={handleChange}
          type="password"
          placeholder="0x..."
          description="API wallet private key from app.hyperliquid.xyz/API. Encrypted at rest."
        />

        <ConfigField
          label="Wallet Address"
          name="hyperliquidWalletAddress"
          value={config.hyperliquidWalletAddress}
          onChange={handleChange}
          type="text"
          placeholder="0x..."
          description="Your master wallet address (used for balance queries)"
        />

        <div className="grid gap-3">
          <label className="text-[14px] font-normal text-white tracking-[-0.01em]">
            Key Created Date
          </label>
          <input
            type="date"
            value={config.hyperliquidKeyCreatedDate?.split("T")[0] ?? ""}
            onChange={(e) => handleChange("hyperliquidKeyCreatedDate" as keyof AppConfig, e.target.value || "")}
            className="bg-black border border-[#404040] text-white focus:border-white focus-visible:ring-0 focus-visible:ring-offset-0 rounded-sm h-11 px-4 transition-colors"
          />
          <p className="text-[11px] text-[#666666] leading-relaxed">
            When this API key was generated. Keys expire after 180 days.
          </p>
        </div>
      </div>

      <SaveFooter onSave={handleSave} saving={saving} />
    </div>
  );
}
```

- [ ] **Step 2: Add nav link (if settings has a sidebar/nav)**

Check `app/settings/layout.tsx` for navigation links and add a "Hyperliquid" entry pointing to `/settings/hyperliquid`.

- [ ] **Step 3: Start dev server and verify**

Run: `bun dev`
Navigate to `http://localhost:3000/settings/hyperliquid` and verify the form renders with all three fields.

- [ ] **Step 4: Commit**

```bash
git add app/settings/hyperliquid/
git commit -m "feat: add Hyperliquid settings page for API key management"
```

---

### Task 11: Update Instrumentation and Env Files

**Files:**
- Modify: `instrumentation.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update instrumentation.ts**

Replace `"MNEMONIC"` with `"DB_ENCRYPTION_KEY"` in both the `ENV_KEYS` array and the `SENSITIVE_KEYS` set.

In `ENV_KEYS`:
```typescript
const ENV_KEYS = [
  "DATABASE_URL",
  "DB_ENCRYPTION_KEY",
  "CRON_EXPRESSION",
  "NEXT_PUBLIC_HYPERLOCAL_URL",
  "HYPERLOCAL_URL",
  "TEST_MODE",
  "LOCAL_TEST",
  "API_URL",
  "CRON_SECRET",
  "LOG_LEVEL",
  "ENABLE_LOGS",
] as const;
```

In `SENSITIVE_KEYS`:
```typescript
const SENSITIVE_KEYS = new Set(["DATABASE_URL", "DB_ENCRYPTION_KEY", "CRON_SECRET"]);
```

- [ ] **Step 2: Update .env.example**

Remove the `MNEMONIC` entry and its comment. Add `DB_ENCRYPTION_KEY`:

Replace:
```
# Wallet seed phrase - 12 words (required, sensitive)
MNEMONIC=your twelve word seed phrase here
```

With:
```
# Encryption key for sensitive DB fields (required, 32 bytes hex)
# Generate with: openssl rand -hex 32
DB_ENCRYPTION_KEY=
```

- [ ] **Step 3: Commit**

```bash
git add instrumentation.ts .env.example
git commit -m "chore: replace MNEMONIC with DB_ENCRYPTION_KEY in env config"
```

---

### Task 12: Update Deploy Workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace MNEMONIC with DB_ENCRYPTION_KEY in deploy.yml**

In the `run_app` function (~line 87), replace:
```
-e MNEMONIC="${{ secrets.DCA_MNEMONIC }}" \
```
With:
```
-e DB_ENCRYPTION_KEY="${{ secrets.DB_ENCRYPTION_KEY }}" \
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: replace DCA_MNEMONIC secret with DB_ENCRYPTION_KEY"
```

---

### Task 13: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Read all three files**

Read `README.md`, `docs/SECURITY.md`, and `ARCHITECTURE.md` in full.

- [ ] **Step 2: Update references**

In all three files:
- Replace references to `MNEMONIC` / mnemonic / seed phrase with the new approach: API key stored encrypted in DB, configured via Settings UI
- Replace references to `mnemonicToAccount` with `privateKeyToAccount`
- Add mention of `DB_ENCRYPTION_KEY` env var where setup instructions exist
- Add note about 180-day key expiry and the 7-day warning

- [ ] **Step 3: Clean up .env.example**

Review `.env.example` one more time — ensure no stale references to MNEMONIC or Solana remain.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/SECURITY.md ARCHITECTURE.md .env.example
git commit -m "docs: update for API key auth migration"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All tests PASS.

- [ ] **Step 2: Run linter**

Run: `bun run lint`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds.

- [ ] **Step 4: Start dev server and smoke test**

Run: `bun dev`
- Navigate to Settings > Hyperliquid — verify form renders
- Save dummy values — verify toast success
- Check other settings pages still work
- Navigate to dashboard — verify it loads (wallet balance will fail without real credentials, which is expected)
