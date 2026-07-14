import { describe, test, expect } from "bun:test";
import {
  EXPIRY_DAYS,
  WARNING_THRESHOLD_DAYS,
  getDaysUntilExpiry,
  shouldWarnExpiry,
} from "./key-expiry";

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

describe("key-expiry", () => {
  describe("constants", () => {
    test("EXPIRY_DAYS is 180", () => {
      expect(EXPIRY_DAYS).toBe(180);
    });

    test("WARNING_THRESHOLD_DAYS is 7", () => {
      expect(WARNING_THRESHOLD_DAYS).toBe(7);
    });
  });

  describe("getDaysUntilExpiry", () => {
    test("returns 180 when key created today", () => {
      // #given
      const today = new Date();

      // #when
      const result = getDaysUntilExpiry(today);

      // #then
      expect(result).toBe(180);
    });

    test("returns 0 when key created 180 days ago", () => {
      // #given
      const createdAt = daysAgo(180);

      // #when
      const result = getDaysUntilExpiry(createdAt);

      // #then
      expect(result).toBe(0);
    });

    test("returns -20 when key created 200 days ago", () => {
      // #given
      const createdAt = daysAgo(200);

      // #when
      const result = getDaysUntilExpiry(createdAt);

      // #then
      expect(result).toBe(-20);
    });

    test("returns 173 when key created 7 days ago", () => {
      // #given
      const createdAt = daysAgo(7);

      // #when
      const result = getDaysUntilExpiry(createdAt);

      // #then
      expect(result).toBe(173);
    });
  });

  describe("shouldWarnExpiry", () => {
    test("returns false when 173 days remain (7 days ago)", () => {
      // #given
      const createdAt = daysAgo(7);

      // #when
      const result = shouldWarnExpiry(createdAt);

      // #then
      expect(result).toBe(false);
    });

    test("returns true when 7 days remain (173 days ago)", () => {
      // #given
      const createdAt = daysAgo(173);

      // #when
      const result = shouldWarnExpiry(createdAt);

      // #then
      expect(result).toBe(true);
    });

    test("returns true when 0 days remain (180 days ago)", () => {
      // #given
      const createdAt = daysAgo(180);

      // #when
      const result = shouldWarnExpiry(createdAt);

      // #then
      expect(result).toBe(true);
    });

    test("returns true when expired (200 days ago)", () => {
      // #given
      const createdAt = daysAgo(200);

      // #when
      const result = shouldWarnExpiry(createdAt);

      // #then
      expect(result).toBe(true);
    });
  });
});
