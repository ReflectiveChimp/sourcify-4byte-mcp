import { z } from "zod";

const CandidateSchema = z.object({
  name: z.string(),
  filtered: z.boolean().default(false),
  hasVerifiedContract: z.boolean().default(false),
});
export type Candidate = z.infer<typeof CandidateSchema>;

const BucketSchema = z.record(z.string(), z.array(CandidateSchema).nullable());

/** Shape of a Sourcify lookup/search response. Used to validate untrusted upstream JSON. */
export const LookupResultSchema = z.object({
  ok: z.boolean().optional(),
  result: z.object({
    function: BucketSchema.optional(),
    event: BucketSchema.optional(),
  }),
});
export type LookupResult = z.infer<typeof LookupResultSchema>;

/** 4-byte function/error selector: 0x + 8 hex. */
export const FUNC_RE = /^0x[0-9a-fA-F]{8}$/;
/** 32-byte event topic0: 0x + 64 hex. */
export const EVENT_RE = /^0x[0-9a-fA-F]{64}$/;

/** Lower-case and ensure a leading 0x. */
export function normalize(hash: string): string {
  const h = hash.trim().toLowerCase();
  return h.startsWith("0x") ? h : `0x${h}`;
}

/** Split raw hashes into function selectors, event topics, and unrecognized inputs. */
export function routeHashes(hashes: string[]): { functions: string[]; events: string[]; invalid: string[] } {
  const functions: string[] = [];
  const events: string[] = [];
  const invalid: string[] = [];
  for (const raw of hashes) {
    const h = normalize(raw);
    if (FUNC_RE.test(h)) functions.push(h);
    else if (EVENT_RE.test(h)) events.push(h);
    else invalid.push(raw);
  }
  return { functions, events, invalid };
}

/** Rank: real (unfiltered) + verified-on-chain candidates first, then alphabetical. */
export function rank(a: Candidate, b: Candidate): number {
  if (a.filtered !== b.filtered) return a.filtered ? 1 : -1;
  if (a.hasVerifiedContract !== b.hasVerifiedContract) return a.hasVerifiedContract ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Join up to `max` candidate names, appending a "+N more" suffix when truncated. */
function capNames(candidates: Candidate[], max: number): string {
  const shown = candidates.slice(0, max);
  const hidden = candidates.length - shown.length;
  const suffix = hidden > 0 ? `, +${hidden} more` : "";
  return `${shown.map((c) => c.name).join(", ")}${suffix}`;
}

export type FormatOptions = {
  /** Drop candidates lacking an on-chain-verified contract (falling back to unverified if none remain). */
  verifiedOnly: boolean;
  /** Cap on the candidate list rendered per hash. */
  maxResults: number;
};

/** Render a hash -> candidate bucket into human-readable lines. */
export function formatBucket(
  bucket: Record<string, Candidate[] | null> | undefined,
  { verifiedOnly, maxResults }: FormatOptions,
): string[] {
  const lines: string[] = [];
  for (const [hash, candidates] of Object.entries(bucket ?? {})) {
    const sorted = (candidates ?? []).slice().sort(rank);
    if (!sorted.length) {
      lines.push(`${hash} -> (no match)`);
      continue;
    }
    const verified = sorted.filter((c) => c.hasVerifiedContract);
    // verifiedOnly requested but nothing is verified: say so, then show the unverified candidates (capped).
    if (verifiedOnly && !verified.length) {
      lines.push(`${hash} -> (only unverified results found)`);
      lines.push(`  candidates: ${capNames(sorted, maxResults)}`);
      continue;
    }
    const shown = verifiedOnly ? verified : sorted;
    const best = shown[0];
    if (!best) {
      lines.push(`${hash} -> (no match)`);
      continue;
    }
    const tags = best.hasVerifiedContract ? " [verified on-chain]" : "";
    lines.push(`${hash} -> ${best.name}${tags}`);
    const rest = shown.slice(1);
    if (rest.length) {
      lines.push(`  other candidates: ${capNames(rest, maxResults)}`);
    }
  }
  return lines;
}
