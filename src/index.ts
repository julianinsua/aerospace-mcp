#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { serverOptions } from "./options.js";
import { createRunners } from "./runners.js";
import { createServer } from "./server.js";

try {
  const runners = createRunners();
  const server = createServer(runners, serverOptions());
  await server.connect(new StdioServerTransport());
  console.error("aerospace-mcp listening on stdio");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aerospace-mcp failed to start: ${message}`);
  process.exit(1);
}
