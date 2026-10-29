import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";
import { monitorTargetArgs, monitorTargetSchema, option, workspaceSchema } from "./args.js";

export const moveWorkspaceToMonitorTool = defineAerospaceTool({
  name: "move_workspace_to_monitor",
  command: "move-workspace-to-monitor",
  readOnly: false,
  description:
    "Move a workspace, with its windows, to another monitor. Acts on the focused workspace unless workspace is given. Focus follows the workspace. Fails for workspaces that the config pins to a monitor.",
  inputSchema: z.object({
    target: monitorTargetSchema.describe(
      'Monitor to move the workspace to: left, down, up or right relative to the focused monitor; next or prev relative to the monitor the workspace is on; a monitor-id from list_monitors (1-based, left to right); main or secondary; or a case-insensitive regex matched against the monitor name (for example "dell")',
    ),
    workspace: workspaceSchema
      .optional()
      .describe(
        'Workspace to move, by name as returned by list_workspaces (for example "1" or "S"). Defaults to the focused workspace',
      ),
    wrapAround: z
      .boolean()
      .optional()
      .describe(
        "Wrap around between the first and last monitors. Only applies to directions and next / prev",
      ),
  }),
  toArgs: ({ target, workspace, wrapAround }) => [
    ...option("workspace", workspace),
    ...monitorTargetArgs(target, wrapAround),
  ],
});
