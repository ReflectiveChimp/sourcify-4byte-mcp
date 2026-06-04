import { BASE_URL, REQUEST_TIMEOUT_MS } from "./config.js";
import { type LookupResult, LookupResultSchema } from "./signatures.js";

/** Thrown for any upstream failure; carries a user-safe, body-free message. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson(path: string, params: URLSearchParams): Promise<LookupResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch (err) {
    // AbortSignal.timeout rejects with a TimeoutError; older runtimes use AbortError.
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new ApiError(`Sourcify request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw new ApiError(`Could not reach Sourcify API at ${BASE_URL}: ${(err as Error).message}`);
  }

  if (!res.ok) {
    // Deliberately do not include the response body (may be HTML / verbose).
    throw new ApiError(`Sourcify API returned HTTP ${res.status}.`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("Sourcify API returned a malformed (non-JSON) response.");
  }

  const parsed = LookupResultSchema.safeParse(body);
  if (!parsed.success) {
    // Validated shape, never the raw body — keeps upstream surprises inside the ApiError channel.
    throw new ApiError("Sourcify API returned an unexpected response shape.");
  }
  return parsed.data;
}

/** Decode function selectors and/or event topic0 hashes. */
export function fetchLookup(functions: string[], events: string[], filter: boolean): Promise<LookupResult> {
  const params = new URLSearchParams();
  if (functions.length) params.set("function", functions.join(","));
  if (events.length) params.set("event", events.join(","));
  params.set("filter", String(filter));
  return getJson("/signature-database/v1/lookup", params);
}

/** Search signatures by name with wildcard support. */
export function fetchSearch(query: string, filter: boolean): Promise<LookupResult> {
  return getJson("/signature-database/v1/search", new URLSearchParams({ query, filter: String(filter) }));
}
