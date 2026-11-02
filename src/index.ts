#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { serverOptions } from "./options.js";
import { createRunners } from "./runners.js";
import { createServer } from "./server.js";

try {
  const runners = createRunners();
  const options = serverOptions();
  const config = await loadConfig(options.configPath);
  const server = createServer(runners, { allowMutations: options.allowMutations, config });
  await server.connect(new StdioServerTransport());
  console.error("aerospace-mcp listening on stdio");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aerospace-mcp failed to start: ${message}`);
  process.exit(1);
}
