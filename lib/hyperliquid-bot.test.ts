import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

class MockHttpRequestError extends Error {
  response?: Response;

  constructor(args?: { response?: Response }) {
    super("HttpRequestError");
    this.name = "HttpRequestError";
    this.response = args?.response;
  }
}

mock.module("@nktkas/hyperliquid", () => ({
  ExchangeClient: class {
    constructor(_: unknown) {}
  },
  HttpRequestError: MockHttpRequestError,
  HttpTransport: class {},
  InfoClient: class {
    constructor(_: unknown) {}
  },
}));

mock.module("viem/accounts", () => ({
  privateKeyToAccount: () => ({ address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }),
}));

const { HyperliquidBot, TransactionSentError, InsufficientBalanceError } = await import("./hyperliquid-bot");

const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_WALLET_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

type MockableBot = { info: unknown; exchange: unknown };
const asMockable = (bot: InstanceType<typeof HyperliquidBot>): MockableBot =>
  bot as unknown as MockableBot;

describe("HyperliquidBot", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  test("sets address to the provided wallet address", () => {
    // #given / #when
    const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

    // #then
    expect(bot.address).toBe(TEST_WALLET_ADDRESS);
  });

  test("throws when private key is empty", () => {
    // #when / #then
    expect(() => new HyperliquidBot("", TEST_WALLET_ADDRESS)).toThrow(
      "Hyperliquid private key not configured"
    );
  });

  test("throws when wallet address is empty", () => {
    // #when / #then
    expect(() => new HyperliquidBot(TEST_PRIVATE_KEY, "")).toThrow(
      "Hyperliquid wallet address not configured"
    );
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

    test("returns spendable USDC after subtracting the held amount", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);
      asMockable(bot).info = {
        spotClearinghouseState: async () => ({
          balances: [
            { coin: "USDC", token: 0, total: "100", hold: "30", entryNtl: "0" },
            { coin: "UBTC", token: 1, total: "0.5", hold: "0", entryNtl: "0" },
          ],
        }),
      };

      // #when
      const balances = await bot.getBalances();

      // #then
      expect(balances.usdc).toBe(70);
      expect(balances.btc).toBe(0.5);
    });
  });

  describe("buy", () => {
    const spotMeta = {
      universe: [{ index: 0, tokens: [1, 0] }],
      tokens: { 1: { name: "UBTC", szDecimals: 3 } },
    };

    test("method exists on bot instance", () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #then
      expect(typeof bot.buy).toBe("function");
    });

    test("throws when currentPrice is zero", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(100, 0)).rejects.toThrow("Invalid currentPrice: 0");
    });

    test("throws when currentPrice is NaN", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(100, NaN)).rejects.toThrow("Invalid currentPrice: NaN");
    });

    test("throws when currentPrice is negative", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(100, -1)).rejects.toThrow("Invalid currentPrice: -1");
    });

    test("throws when currentPrice is Infinity", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(100, Infinity)).rejects.toThrow("Invalid currentPrice: Infinity");
    });

    test("throws when usdAmount is zero", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(0, 50000)).rejects.toThrow("Invalid usdAmount: 0");
    });

    test("throws when usdAmount is NaN", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);

      // #when / #then
      await expect(bot.buy(NaN, 50000)).rejects.toThrow("Invalid usdAmount: NaN");
    });

    test("rethrows transport failures without wrapping them as TransactionSentError", async () => {
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);
      const transportError = new MockHttpRequestError({});

      asMockable(bot).info = {
        spotMeta: async () => spotMeta,
      };
      asMockable(bot).exchange = {
        order: async () => {
          throw transportError;
        },
      };

      let thrown: unknown;
      try {
        await bot.buy(100, 50000);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(transportError);
      expect(thrown).not.toBeInstanceOf(TransactionSentError);
    });

    test("throws InsufficientBalanceError without sending the order when available USDC is below the reserved notional", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);
      let orderCalled = false;
      asMockable(bot).info = { spotMeta: async () => spotMeta };
      asMockable(bot).exchange = {
        order: async () => {
          orderCalled = true;
          return { response: { data: { statuses: [{ filled: { totalSz: "0.001", avgPx: "50250", oid: 1 } }] } } };
        },
      };

      // #when / #then
      await expect(bot.buy(10, 50000, 10)).rejects.toBeInstanceOf(InsufficientBalanceError);
      expect(orderCalled).toBe(false);
    });

    test("sends the order when available USDC covers the reserved notional", async () => {
      // #given
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);
      asMockable(bot).info = { spotMeta: async () => spotMeta };
      asMockable(bot).exchange = {
        order: async () => ({
          response: { data: { statuses: [{ filled: { totalSz: "0.001", avgPx: "50250", oid: 1 } }] } },
        }),
      };

      // #when
      const result = await bot.buy(10, 50000, 100);

      // #then
      expect(result.orderId).toBe(1);
      expect(result.filledQty).toBe(0.001);
    });

    test("wraps errors when Hyperliquid replied but the outcome is still ambiguous", async () => {
      const bot = new HyperliquidBot(TEST_PRIVATE_KEY, TEST_WALLET_ADDRESS);
      const response = new Response("gateway timeout", {
        headers: { "Content-Type": "text/plain" },
        status: 504,
        statusText: "Gateway Timeout",
      });
      const ambiguousError = new MockHttpRequestError({ response });

      asMockable(bot).info = {
        spotMeta: async () => spotMeta,
      };
      asMockable(bot).exchange = {
        order: async () => {
          throw ambiguousError;
        },
      };

      await expect(bot.buy(100, 50000)).rejects.toBeInstanceOf(TransactionSentError);
    });
  });
});
