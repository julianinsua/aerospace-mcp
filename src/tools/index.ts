import { closeWindowTool } from "./close-window.js";
import { focusBackAndForthTool } from "./focus-back-and-forth.js";
import { focusMonitorTool } from "./focus-monitor.js";
import { focusWindowTool } from "./focus-window.js";
import { getConfigTool } from "./get-config.js";
import { listAppsTool } from "./list-apps.js";
import { listInstalledAppsTool } from "./list-installed-apps.js";
import { listModesTool } from "./list-modes.js";
import { listMonitorsTool } from "./list-monitors.js";
import { listWindowsTool } from "./list-windows.js";
import { listWorkspacesTool } from "./list-workspaces.js";
import { moveWindowTool } from "./move-window.js";
import { moveWindowToMonitorTool } from "./move-window-to-monitor.js";
import { moveWindowToWorkspaceTool } from "./move-window-to-workspace.js";
import { moveWorkspaceToMonitorTool } from "./move-workspace-to-monitor.js";
import { openAppTool } from "./open-app.js";
import { summonWorkspaceTool } from "./summon-workspace.js";
import { switchWorkspaceTool } from "./switch-workspace.js";
import type { Tool } from "./tool.js";
import { workspaceBackAndForthTool } from "./workspace-back-and-forth.js";

export const tools: Tool[] = [
  closeWindowTool,
  focusBackAndForthTool,
  focusMonitorTool,
  focusWindowTool,
  getConfigTool,
  listAppsTool,
  listInstalledAppsTool,
  listModesTool,
  listMonitorsTool,
  listWindowsTool,
  listWorkspacesTool,
  moveWindowTool,
  moveWindowToMonitorTool,
  moveWindowToWorkspaceTool,
  moveWorkspaceToMonitorTool,
  openAppTool,
  summonWorkspaceTool,
  switchWorkspaceTool,
  workspaceBackAndForthTool,
];
