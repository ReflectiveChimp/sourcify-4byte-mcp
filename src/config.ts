import pkg from "../package.json" with { type: "json" };

const DEFAULT_BASE_URL = "https://api.4byte.sourcify.dev";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESULTS = 20;

/** Parse a positive-integer env value, falling back when absent, blank, or invalid. */
export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Sourcify signature-database base URL. Override with SOURCIFY_API_URL. */
export const BASE_URL = (process.env.SOURCIFY_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

/** Per-request timeout in ms. Override with SOURCIFY_TIMEOUT_MS. */
export const REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.SOURCIFY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

/** Max candidates listed per hash before truncating with "+N more". Override with SOURCIFY_MAX_RESULTS. */
export const MAX_RESULTS = parsePositiveInt(process.env.SOURCIFY_MAX_RESULTS, DEFAULT_MAX_RESULTS);

/** Server version, surfaced via MCP handshake and `--version`. Sourced from package.json (inlined at build time). */
export const VERSION = pkg.version;
