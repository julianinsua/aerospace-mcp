import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AerospaceRunner } from "./aerospace.js";
import { tools } from "./tools/index.js";
import { registerAerospaceTool } from "./tools/tool.js";

export const SERVER_NAME = "aerospace-mcp";
export const SERVER_VERSION = "0.0.0";

export const SERVER_INSTRUCTIONS =
  'Controls the local AeroSpace window manager on this Mac. Call list_workspaces or list_windows first and copy workspace names and window ids from their output; workspace names are strings such as "1" or "S". Tools that move or close windows exist only when the server runs with AEROSPACE_ALLOW_MUTATIONS=1. close_window requires confirm: true; set it only when the user explicitly asked to close that window.';

export function createServer(
  runner: AerospaceRunner,
  { allowMutations = process.env.AEROSPACE_ALLOW_MUTATIONS === "1" } = {},
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const availableTools = tools.filter((t) => allowMutations || t.readOnly);

  for (const tool of availableTools) {
    registerAerospaceTool(server, runner, tool);
  }

  return server;
}
