# sourcify-4byte-mcp

An MCP server that decodes EVM signatures via the
[Sourcify signature database](https://api.4byte.sourcify.dev) (OpenChain-compatible 4byte API).
Give it function/error selectors or event topic hashes and it returns human-readable signatures,
ranking real, on-chain-verified candidates first.

## Tools

- **`decode_signature`** — `{ hashes: string[], filter?: boolean, verifiedOnly?: boolean }`
  Decode 4-byte function/error selectors (`0x` + 8 hex) and 32-byte event topic0
  hashes (`0x` + 64 hex), 1-50 per call. Hashes are auto-routed by length; the `0x` prefix is optional.
  The best (unfiltered + on-chain-verified) candidate is shown first.
  - `0xa9059cbb` → `transfer(address,uint256) [verified on-chain]`
  - `0xbb757047c2b5f3974fe26b7c10f732e7bce710b0952a71082702781e62ae0595` → `EmergencyWithdraw(address,uint256,uint256)`
- **`search_signature`** — `{ query: string, filter?: boolean, verifiedOnly?: boolean }`
  Search signatures by name with `*` / `?` wildcards (case-sensitive; upstream returns up
  to 100 matches, each hash's candidate list capped by `SOURCIFY_MAX_RESULTS`).

`filter` defaults to `true` (hides junk/spam signatures); set it `false` to see every raw candidate.

`verifiedOnly` defaults to `true` (shows only signatures backed by an on-chain-verified
contract). If a hash has _no_ verified candidate, it falls back to listing the unverified
ones, flagged as `only unverified results found`. Each candidate list is capped at
`SOURCIFY_MAX_RESULTS` entries (default 20), with a trailing `+N more` when truncated.

## Install / run

Runs on **Node** (≥22) via `npx`, or directly under **Bun** for development.

### As an MCP server

```bash
# Add to ~/.claude.json under mcpServers
claude mcp add --scope user sourcify-4byte -- npx -y sourcify-4byte-mcp

# Add to ~/.claude.json under projects[cwd].mcpServers
claude mcp add --scope local sourcify-4byte -- npx -y sourcify-4byte-mcp

# Add to ./.mcp.json
claude mcp add --scope project sourcify-4byte -- npx -y sourcify-4byte-mcp
```

Restart the session to load it. Tools then appear as
`mcp__sourcify-4byte__decode_signature` / `…__search_signature`.
(The npm package is `sourcify-4byte-mcp`; the server identity — and therefore the tool
prefix — is `sourcify-4byte`.)

To remove:
```bash
# Remove from ~/.claude.json under mcpServers
claude mcp remove --scope user sourcify-4byte

# Remove from ~/.claude.json under projects[cwd].mcpServers
claude mcp remove --scope local sourcify-4byte

# Remove from ./.mcp.json
claude mcp remove --scope project sourcify-4byte
```

## Configuration

| Env var                | Default                          | Purpose                                          |
| ---------------------- | -------------------------------- | ------------------------------------------------ |
| `SOURCIFY_API_URL`     | `https://api.4byte.sourcify.dev` | Upstream signature-database base                 |
| `SOURCIFY_TIMEOUT_MS`  | `20000`                          | Per-request timeout in ms                        |
| `SOURCIFY_MAX_RESULTS` | `20`                             | Max candidates listed per hash before `+N more`  |

## Development

```sh
bun install
bun run dev          # run the server from source (speaks MCP over stdio)
bun run typecheck    # tsc --noEmit (strict)
bun run lint         # biome check .
bun test             # unit + handler tests
bun run build        # bundle to dist/index.js (Node-targeted, executable)
node dist/index.js --version   # also: --help
```

`bun run dev` and `bun test` use Bun; the published artifact (`dist/index.js`) is plain
Node-compatible ESM and is what runs via `npx`.

## Troubleshooting

- **Tools don't appear** — confirm the `mcpServers` entry and restart the client; `npx`
  needs network access on first run to fetch the package.
- **"Sourcify request timed out"** — the upstream API was slow or unreachable; raise
  `SOURCIFY_TIMEOUT_MS` or check connectivity.
- **"Sourcify API returned HTTP …"** — upstream returned an error; retry, or point
  `SOURCIFY_API_URL` at a known-good endpoint.

## License

MIT — see [LICENSE](LICENSE).
