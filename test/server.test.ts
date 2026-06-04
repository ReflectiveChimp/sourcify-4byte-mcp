import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/tools.js";

afterEach(() => {
  spyOn(globalThis, "fetch").mockRestore();
});

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function mockFetchJson(body: unknown): void {
  spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
  );
}

describe("server integration", () => {
  test("lists both tools, each exposing filter + verifiedOnly", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["decode_signature", "search_signature"]);
    for (const t of tools) {
      const props = (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(Object.keys(props)).toContain("filter");
      expect(Object.keys(props)).toContain("verifiedOnly");
    }
    await client.close();
  });

  test("decode_signature rejects more than 50 hashes at the schema boundary (no fetch)", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    const client = await connectClient();
    const hashes = Array.from({ length: 51 }, () => "0xa9059cbb");
    const res = await client.callTool({ name: "decode_signature", arguments: { hashes } });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toMatch(/validation error/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    await client.close();
  });

  test("decode_signature accepts 50 hashes (at the cap)", async () => {
    mockFetchJson({ ok: true, result: {} });
    const client = await connectClient();
    const hashes = Array.from({ length: 50 }, () => "0xa9059cbb");
    const res = await client.callTool({ name: "decode_signature", arguments: { hashes } });
    expect(res.isError).toBeFalsy();
    expect(JSON.stringify(res.content)).not.toMatch(/validation error/i);
    await client.close();
  });

  test("decode_signature round-trips a verified result through the protocol", async () => {
    mockFetchJson({
      ok: true,
      result: {
        function: { "0xa9059cbb": [{ name: "transfer(address,uint256)", filtered: false, hasVerifiedContract: true }] },
      },
    });
    const client = await connectClient();
    const res = await client.callTool({ name: "decode_signature", arguments: { hashes: ["0xa9059cbb"] } });
    expect(res.isError).toBeFalsy();
    expect(JSON.stringify(res.content)).toContain("transfer(address,uint256) [verified on-chain]");
    await client.close();
  });
});
