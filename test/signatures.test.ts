import { describe, expect, test } from "bun:test";
import { type Candidate, formatBucket, normalize, rank, routeHashes } from "../src/signatures.js";

describe("normalize", () => {
  test("adds 0x prefix and lowercases", () => {
    expect(normalize("A9059CBB")).toBe("0xa9059cbb");
  });
  test("keeps existing 0x prefix and trims", () => {
    expect(normalize("  0xA9059CBB  ")).toBe("0xa9059cbb");
  });
});

describe("routeHashes", () => {
  test("routes by length: function, event, invalid", () => {
    const fn = "0xa9059cbb";
    const ev = `0x${"d".repeat(64)}`;
    const { functions, events, invalid } = routeHashes([fn, ev, "nope", "0x1234"]);
    expect(functions).toEqual([fn]);
    expect(events).toEqual([ev]);
    expect(invalid).toEqual(["nope", "0x1234"]);
  });
  test("normalizes inputs before routing", () => {
    const { functions } = routeHashes(["A9059CBB"]);
    expect(functions).toEqual(["0xa9059cbb"]);
  });
});

describe("rank", () => {
  const c = (over: Partial<Candidate>): Candidate => ({
    name: "z",
    filtered: false,
    hasVerifiedContract: false,
    ...over,
  });

  test("unfiltered before filtered", () => {
    expect(rank(c({ filtered: false }), c({ filtered: true }))).toBeLessThan(0);
  });
  test("verified-on-chain before not, when filtered is equal", () => {
    expect(rank(c({ hasVerifiedContract: true }), c({ hasVerifiedContract: false }))).toBeLessThan(0);
  });
  test("alphabetical as final tiebreak", () => {
    expect(rank(c({ name: "a" }), c({ name: "b" }))).toBeLessThan(0);
  });
  test("sorts a list best-first", () => {
    const list = [
      c({ name: "junk", filtered: true }),
      c({ name: "plain" }),
      c({ name: "verified", hasVerifiedContract: true }),
    ];
    expect([...list].sort(rank).map((x) => x.name)).toEqual(["verified", "plain", "junk"]);
  });
});

describe("formatBucket", () => {
  const ALL = { verifiedOnly: false, maxResults: 20 };
  const VERIFIED = { verifiedOnly: true, maxResults: 20 };

  test("undefined bucket -> no lines", () => {
    expect(formatBucket(undefined, ALL)).toEqual([]);
  });
  test("empty/null candidates -> (no match)", () => {
    expect(formatBucket({ "0xabcdef12": null }, ALL)).toEqual(["0xabcdef12 -> (no match)"]);
    expect(formatBucket({ "0xabcdef12": [] }, VERIFIED)).toEqual(["0xabcdef12 -> (no match)"]);
  });
  test("single candidate, verified-on-chain tag", () => {
    const bucket = {
      "0xa9059cbb": [{ name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true }],
    };
    expect(formatBucket(bucket, VERIFIED)).toEqual(["0xa9059cbb -> transfer(address,uint256) [verified on-chain]"]);
  });
  test("verifiedOnly=false: best first plus other candidates line", () => {
    const bucket = {
      "0xa9059cbb": [
        { name: "junk(uint256)", filtered: true, hasVerifiedContract: false },
        { name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: false },
      ],
    };
    expect(formatBucket(bucket, ALL)).toEqual([
      "0xa9059cbb -> transfer(address,uint256)",
      "  other candidates: junk(uint256)",
    ]);
  });

  test("verifiedOnly drops unverified candidates, keeping only verified", () => {
    const bucket = {
      "0xa9059cbb": [
        { name: "verified(address)", filtered: false, hasVerifiedContract: true },
        { name: "spoof(uint256)", filtered: false, hasVerifiedContract: false },
      ],
    };
    expect(formatBucket(bucket, VERIFIED)).toEqual(["0xa9059cbb -> verified(address) [verified on-chain]"]);
  });

  test("verifiedOnly with no verified -> 'only unverified results found' plus capped list", () => {
    const bucket = {
      "0xa9059cbb": [
        { name: "alpha()", filtered: false, hasVerifiedContract: false },
        { name: "beta()", filtered: false, hasVerifiedContract: false },
      ],
    };
    expect(formatBucket(bucket, VERIFIED)).toEqual([
      "0xa9059cbb -> (only unverified results found)",
      "  candidates: alpha(), beta()",
    ]);
  });

  test("maxResults caps the 'other candidates' tail with a +N more suffix", () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      name: `f${i}()`,
      filtered: false,
      hasVerifiedContract: false,
    }));
    expect(formatBucket({ "0xa9059cbb": candidates }, { verifiedOnly: false, maxResults: 2 })).toEqual([
      "0xa9059cbb -> f0()",
      "  other candidates: f1(), f2(), +2 more",
    ]);
  });

  test("maxResults caps the unverified fallback list", () => {
    const candidates = Array.from({ length: 4 }, (_, i) => ({
      name: `u${i}()`,
      filtered: false,
      hasVerifiedContract: false,
    }));
    expect(formatBucket({ "0xa9059cbb": candidates }, { verifiedOnly: true, maxResults: 2 })).toEqual([
      "0xa9059cbb -> (only unverified results found)",
      "  candidates: u0(), u1(), +2 more",
    ]);
  });

  test("renders each hash in a multi-hash bucket independently", () => {
    const bucket = {
      "0xaaaaaaaa": [{ name: "a()", filtered: false, hasVerifiedContract: true }],
      "0xbbbbbbbb": [{ name: "b()", filtered: false, hasVerifiedContract: true }],
    };
    expect(formatBucket(bucket, VERIFIED)).toEqual([
      "0xaaaaaaaa -> a() [verified on-chain]",
      "0xbbbbbbbb -> b() [verified on-chain]",
    ]);
  });
});
