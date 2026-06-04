# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added

- `decode_signature` tool — decode EVM 4-byte function/error selectors and 32-byte event topic0 hashes (1–50 per call).
- `search_signature` tool — search the Sourcify signature database by name with `*` / `?` wildcards.
- `filter` and `verifiedOnly` options on both tools — on-chain-verified candidates are surfaced first, with unverified results shown only as a flagged fallback.
- Configurable upstream via `SOURCIFY_API_URL`, per-request timeout via `SOURCIFY_TIMEOUT_MS`, and per-hash result cap via `SOURCIFY_MAX_RESULTS`.
- Request timeouts, runtime validation of upstream responses, and clean, body-free error messages for upstream failures.
- npm packaging with an `npx`-runnable bin, plus unit/handler tests and CI.
