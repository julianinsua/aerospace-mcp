import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Runners } from "./runners.js";
import { tools } from "./tools/index.js";
import { registerTool } from "./tools/tool.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

export const SERVER_NAME = "aerospace-mcp";
export const SERVER_VERSION = version;

export const SERVER_INSTRUCTIONS =
  'Controls the local AeroSpace window manager on this Mac. Call list_monitors, list_workspaces or list_windows first and copy monitor ids, workspace names and window ids from their output; workspace names are strings such as "1" or "S". Use list_apps to find the bundle ids of running apps for list_windows, list_installed_apps to find the bundle id of an app that is not running for open_app, and list_modes or get_config to inspect binding modes and key bindings. Tools that move windows or workspaces, close windows or launch apps exist only when the server runs with --allow-mutations or AEROSPACE_ALLOW_MUTATIONS=1. close_window requires confirm: true; set it only when the user explicitly asked to close that window.';

export function createServer(
  runners: Runners,
  { allowMutations = process.env.AEROSPACE_ALLOW_MUTATIONS === "1" } = {},
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const availableTools = tools.filter((t) => allowMutations || t.readOnly);

  for (const tool of availableTools) {
    registerTool(server, runners, tool);
  }

  return server;
}
