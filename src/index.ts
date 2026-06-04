#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VERSION } from "./config.js";
import { createServer } from "./tools.js";

const arg = process.argv[2];

if (arg === "--version" || arg === "-v") {
  console.log(VERSION);
  process.exit(0);
}

if (arg === "--help" || arg === "-h") {
  console.log(
    [
      `sourcify-4byte-mcp ${VERSION}`,
      "",
      "An MCP server that decodes EVM function/error/event signatures via the Sourcify 4byte API.",
      "Speaks the Model Context Protocol over stdio; run it from an MCP client, not interactively.",
      "",
      "Tools: decode_signature, search_signature",
      "Env:   SOURCIFY_API_URL (default https://api.4byte.sourcify.dev), SOURCIFY_TIMEOUT_MS (default 20000)",
    ].join("\n"),
  );
  process.exit(0);
}

await createServer().connect(new StdioServerTransport());
