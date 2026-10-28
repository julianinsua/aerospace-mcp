import { closeWindowTool } from "./close-window.js";
import { focusWindowTool } from "./focus-window.js";
import { listMonitorsTool } from "./list-monitors.js";
import { listWindowsTool } from "./list-windows.js";
import { listWorkspacesTool } from "./list-workspaces.js";
import { moveWindowTool } from "./move-window.js";
import { moveWindowToWorkspaceTool } from "./move-window-to-workspace.js";
import type { AerospaceTool } from "./tool.js";

export const tools: AerospaceTool[] = [
  closeWindowTool,
  focusWindowTool,
  listMonitorsTool,
  listWindowsTool,
  listWorkspacesTool,
  moveWindowTool,
  moveWindowToWorkspaceTool,
];
