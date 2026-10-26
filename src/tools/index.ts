import { listWindowsTool } from "./list-windows.js";
import { listWorkspacesTool } from "./list-workspaces.js";
import { moveWindowTool } from "./move-window.js";
import { moveWindowToWorkspaceTool } from "./move-window-to-workspace.js";
import type { AerospaceTool } from "./tool.js";

export const tools: AerospaceTool[] = [
  listWorkspacesTool,
  listWindowsTool,
  moveWindowTool,
  moveWindowToWorkspaceTool,
];
