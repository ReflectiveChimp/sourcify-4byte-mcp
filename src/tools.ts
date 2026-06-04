import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError, fetchLookup, fetchSearch } from "./api.js";
import { MAX_RESULTS, VERSION } from "./config.js";
import { type FormatOptions, formatBucket, type LookupResult, routeHashes } from "./signatures.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function text(body: string, isError = false): ToolResult {
  return isError
    ? { isError: true, content: [{ type: "text", text: body }] }
    : { content: [{ type: "text", text: body }] };
}

function errorText(err: unknown): ToolResult {
  const body = err instanceof ApiError ? err.message : `Unexpected error: ${(err as Error).message}`;
  return text(body, true);
}

/** decode_signature handler. Exported for direct testing. */
export async function decodeSignature({
  hashes,
  filter,
  verifiedOnly,
}: {
  hashes: string[];
  filter?: boolean;
  verifiedOnly?: boolean;
}): Promise<ToolResult> {
  const { functions, events, invalid } = routeHashes(hashes);

  if (!functions.length && !events.length) {
    return text(
      `No valid hashes. Expected 0x+8 hex (function/error) or 0x+64 hex (event). Invalid: ${invalid.join(", ")}`,
      true,
    );
  }

  let data: LookupResult;
  try {
    data = await fetchLookup(functions, events, filter ?? true);
  } catch (err) {
    return errorText(err);
  }

  const opts: FormatOptions = { verifiedOnly: verifiedOnly ?? true, maxResults: MAX_RESULTS };
  const lines: string[] = [];
  if (functions.length) {
    lines.push("Functions / errors (4-byte):");
    lines.push(...formatBucket(data.result.function, opts));
  }
  if (events.length) {
    if (lines.length) lines.push("");
    lines.push("Events (topic0):");
    lines.push(...formatBucket(data.result.event, opts));
  }
  if (invalid.length) {
    lines.push("");
    lines.push(`Ignored (not a valid 4-byte or 32-byte hash): ${invalid.join(", ")}`);
  }

  return text(lines.join("\n"));
}

/** search_signature handler. Exported for direct testing. */
export async function searchSignature({
  query,
  filter,
  verifiedOnly,
}: {
  query: string;
  filter?: boolean;
  verifiedOnly?: boolean;
}): Promise<ToolResult> {
  let data: LookupResult;
  try {
    data = await fetchSearch(query, filter ?? true);
  } catch (err) {
    return errorText(err);
  }

  const opts: FormatOptions = { verifiedOnly: verifiedOnly ?? true, maxResults: MAX_RESULTS };
  const lines: string[] = [];
  const fns = formatBucket(data.result.function, opts);
  const evs = formatBucket(data.result.event, opts);
  if (fns.length) {
    lines.push("Functions / errors:");
    lines.push(...fns);
  }
  if (evs.length) {
    if (lines.length) lines.push("");
    lines.push("Events:");
    lines.push(...evs);
  }
  return text(lines.length ? lines.join("\n") : `No matches for '${query}'.`);
}

/** Build the MCP server with both tools registered (not yet connected to a transport). */
export function createServer(): McpServer {
  const server = new McpServer({ name: "sourcify-4byte", version: VERSION });

  server.registerTool(
    "decode_signature",
    {
      title: "Decode EVM signature",
      description:
        "Decode EVM 4-byte function/error selectors (0x + 8 hex) and 32-byte event topic0 hashes (0x + 64 hex) " +
        "into human-readable signatures via the Sourcify signature database. " +
        "Pass any mix of hashes; they are auto-routed by length. " +
        "Example: 0xa9059cbb -> transfer(address,uint256); " +
        "0xddf252ad...b3ef -> Transfer(address,address,uint256).",
      inputSchema: {
        hashes: z
          .array(z.string())
          .min(1)
          .max(50)
          .describe(
            "Hex hashes to decode (1-50). 10-char (0x+8) = function or error selector; 66-char (0x+64) = event topic0. The 0x prefix is optional.",
          ),
        filter: z
          .boolean()
          .optional()
          .describe("Filter out junk/spam signatures (default true). Set false to see every raw candidate."),
        verifiedOnly: z
          .boolean()
          .optional()
          .describe(
            "Show only signatures backed by an on-chain-verified contract (default true). When none are verified, falls back to the unverified candidates, flagged as such.",
          ),
      },
    },
    decodeSignature,
  );

  server.registerTool(
    "search_signature",
    {
      title: "Search EVM signatures by name",
      description:
        "Search the Sourcify signature database by signature name using wildcards (* and ?). " +
        "Case-sensitive, returns up to 100 matches with their selectors/topic0 hashes. " +
        "Example query: 'transfer*' or 'Swap(*)'.",
      inputSchema: {
        query: z.string().min(1).describe("Signature name pattern. Supports * (any chars) and ? (one char)."),
        filter: z.boolean().optional().describe("Filter out junk results (default true)."),
        verifiedOnly: z
          .boolean()
          .optional()
          .describe(
            "Show only signatures backed by an on-chain-verified contract (default true). When none are verified, falls back to the unverified candidates, flagged as such.",
          ),
      },
    },
    searchSignature,
  );

  return server;
}
