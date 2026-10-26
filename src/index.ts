#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createExecRunner } from "./aerospace.js";
import { createServer } from "./server.js";

const server = createServer(createExecRunner());
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
  console.error("aerospace-mcp listening on stdio");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aerospace-mcp failed to start: ${message}`);
  process.exit(1);
}
