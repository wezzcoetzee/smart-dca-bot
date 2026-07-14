import { describe, test, expect } from "bun:test";
import { encrypt, decrypt } from "./encryption";

const TEST_KEY = "a".repeat(64);

describe("encryption", () => {
  describe("encrypt", () => {
    test("returns empty string for empty input", () => {
      // #given
      const plaintext = "";

      // #when
      const result = encrypt(plaintext, TEST_KEY);

      // #then
      expect(result).toBe("");
    });

    test("produces different ciphertext each call due to random IV", () => {
      // #given
      const plaintext = "secret-api-key";

      // #when
      const first = encrypt(plaintext, TEST_KEY);
      const second = encrypt(plaintext, TEST_KEY);

      // #then
      expect(first).not.toBe(second);
    });

    test("returns a base64 string", () => {
      // #given
      const plaintext = "secret-api-key";

      // #when
      const result = encrypt(plaintext, TEST_KEY);

      // #then
      expect(() => Buffer.from(result, "base64")).not.toThrow();
      expect(Buffer.from(result, "base64").toString("base64")).toBe(result);
    });
  });

  describe("decrypt", () => {
    test("returns empty string for empty input", () => {
      // #given
      const ciphertext = "";

      // #when
      const result = decrypt(ciphertext, TEST_KEY);

      // #then
      expect(result).toBe("");
    });

    test("round-trip: decrypt(encrypt(x)) returns original plaintext", () => {
      // #given
      const plaintext = "my-hyperliquid-private-key-abc123";

      // #when
      const ciphertext = encrypt(plaintext, TEST_KEY);
      const result = decrypt(ciphertext, TEST_KEY);

      // #then
      expect(result).toBe(plaintext);
    });

    test("throws when decrypting with wrong key", () => {
      // #given
      const plaintext = "secret-api-key";
      const wrongKey = "b".repeat(64);
      const ciphertext = encrypt(plaintext, TEST_KEY);

      // #when / #then
      expect(() => decrypt(ciphertext, wrongKey)).toThrow();
    });
  });
});
