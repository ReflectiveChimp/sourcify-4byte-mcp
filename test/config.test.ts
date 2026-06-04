import { describe, expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { MAX_RESULTS, parsePositiveInt, REQUEST_TIMEOUT_MS, VERSION } from "../src/config.js";

describe("parsePositiveInt", () => {
  test("parses a valid positive integer", () => {
    expect(parsePositiveInt("20", 99)).toBe(20);
  });
  test("floors a positive fractional value", () => {
    expect(parsePositiveInt("1.9", 99)).toBe(1);
  });
  test("falls back on undefined / blank / whitespace", () => {
    expect(parsePositiveInt(undefined, 99)).toBe(99);
    expect(parsePositiveInt("", 99)).toBe(99);
    expect(parsePositiveInt("   ", 99)).toBe(99);
  });
  test("falls back on zero, negative, non-numeric, and Infinity", () => {
    expect(parsePositiveInt("0", 99)).toBe(99);
    expect(parsePositiveInt("-5", 99)).toBe(99);
    expect(parsePositiveInt("abc", 99)).toBe(99);
    expect(parsePositiveInt("Infinity", 99)).toBe(99);
  });
});

describe("MAX_RESULTS", () => {
  test("defaults to 20 when SOURCIFY_MAX_RESULTS is unset", () => {
    if (process.env.SOURCIFY_MAX_RESULTS === undefined) {
      expect(MAX_RESULTS).toBe(20);
    }
  });
});

describe("REQUEST_TIMEOUT_MS", () => {
  test("defaults to 20000 when SOURCIFY_TIMEOUT_MS is unset (no RangeError-prone parse)", () => {
    if (process.env.SOURCIFY_TIMEOUT_MS === undefined) {
      expect(REQUEST_TIMEOUT_MS).toBe(20000);
    }
    // Regardless of env, the parsed value must be a valid AbortSignal.timeout delay.
    expect(Number.isInteger(REQUEST_TIMEOUT_MS)).toBe(true);
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

describe("VERSION", () => {
  test("is sourced from package.json (no manual drift)", () => {
    expect(VERSION).toBe(pkg.version);
  });
});
