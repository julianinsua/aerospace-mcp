import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AerospaceRunner } from "./aerospace.js";
import { tools } from "./tools/index.js";
import { registerAerospaceTool } from "./tools/tool.js";

export const SERVER_NAME = "aerospace-mcp";
export const SERVER_VERSION = "0.0.0";

export const SERVER_INSTRUCTIONS =
  "Controls the local AeroSpace window manager on this Mac. list_workspaces and list_windows are read-only and return AeroSpace's JSON. move_window and move_window_to_workspace change window placement; list first so you know what you are moving.";

export function createServer(runner: AerospaceRunner): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  for (const tool of tools) {
    registerAerospaceTool(server, runner, tool);
  }
  return server;
}
