import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { decodeSignature, searchSignature } from "../src/tools.js";

function mockFetchJson(body: unknown, status = 200): void {
  spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
});

describe("decodeSignature", () => {
  test("happy path formats function result", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: { "0xa9059cbb": [{ name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true }] },
      },
    });
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toContain("transfer(address,uint256) [verified on-chain]");
  });

  test("all-invalid input -> isError without calling fetch", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    const res = await decodeSignature({ hashes: ["not-a-hash"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("No valid hashes");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("HTTP error -> clean isError, no raw body leak", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>500 internal</html>", { status: 500 }));
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("HTTP 500");
    expect(res.content[0]?.text).not.toContain("<html>");
  });

  test("timeout -> clean isError", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/timed out/i);
  });

  test("network error -> clean isError", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/Could not reach Sourcify API/i);
  });

  test("malformed JSON -> clean isError", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/malformed/i);
  });

  test("valid JSON of an unexpected shape -> clean isError (no raw TypeError leak)", async () => {
    // 200 with syntactically-valid JSON that doesn't match the response schema.
    mockFetchJson({ ok: false }); // no `result`
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/unexpected response shape/i);
    expect(res.content[0]?.text).not.toMatch(/Cannot read|undefined is not/i);
  });

  test("result with a non-object bucket -> clean isError", async () => {
    mockFetchJson({ ok: true, result: { function: "nope" } });
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/unexpected response shape/i);
  });

  test("verifiedOnly defaults true: unverified candidates are dropped", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: {
          "0xa9059cbb": [
            { name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true },
            { name: "spoof(uint256)", filtered: false, hasVerifiedContract: false },
          ],
        },
      },
    });
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.content[0]?.text).toContain("transfer(address,uint256) [verified on-chain]");
    expect(res.content[0]?.text).not.toContain("spoof");
  });

  test("verifiedOnly=false includes unverified candidates", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: {
          "0xa9059cbb": [
            { name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true },
            { name: "spoof(uint256)", filtered: false, hasVerifiedContract: false },
          ],
        },
      },
    });
    const res = await decodeSignature({ hashes: ["0xa9059cbb"], verifiedOnly: false });
    expect(res.content[0]?.text).toContain("spoof(uint256)");
  });

  test("verifiedOnly with no verified match -> 'only unverified results found'", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: {
          "0xa9059cbb": [{ name: "spoof(uint256)", filtered: false, hasVerifiedContract: false }],
        },
      },
    });
    const res = await decodeSignature({ hashes: ["0xa9059cbb"] });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toContain("only unverified results found");
    expect(res.content[0]?.text).toContain("spoof(uint256)");
  });
});

describe("searchSignature", () => {
  test("happy path groups functions and events", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: {
          "0xa9059cbb": [{ name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: false }],
        },
        event: {
          [`0x${"d".repeat(64)}`]: [
            { name: "Transfer(address,address,uint256)", filtered: false, hasVerifiedContract: false },
          ],
        },
      },
    });
    const res = await searchSignature({ query: "transfer*", verifiedOnly: false });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toContain("Functions / errors:");
    expect(res.content[0]?.text).toContain("Events:");
  });

  test("no matches -> friendly message", async () => {
    mockFetchJson({ ok: true, result: {} });
    const res = await searchSignature({ query: "nope" });
    expect(res.isError).toBeFalsy();
    expect(res.content[0]?.text).toBe("No matches for 'nope'.");
  });

  test("upstream failure -> clean isError", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 502 }));
    const res = await searchSignature({ query: "transfer*" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("HTTP 502");
  });
});
