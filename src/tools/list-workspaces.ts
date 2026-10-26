import { z } from "zod";
import { format, monitorSchema, option, scopeSchema, toggle } from "./args.js";
import { defineTool } from "./tool.js";

export const listWorkspacesTool = defineTool({
  name: "list_workspaces",
  command: "list-workspaces",
  readOnly: true,
  description:
    "List AeroSpace workspaces. scope all lists every workspace; focused lists the workspace that has focus. monitor targets workspaces assigned to a monitor. monitor all targets all monitors, monitor focused targets the monitor with current focus, monitor mouse targets the monitor where the mouse is currently placed. visible filters workspaces that are currently visible or not; if it's not set, both are included. empty filters workspaces that are currently empty or not; if it's not set, both are included.",
  inputSchema: z.object({
    scope: scopeSchema.optional().describe("Use a shortcut to select workspaces"),
    monitor: monitorSchema,
    visible: z.boolean().optional().describe("Filter visible workspaces"),
    empty: z.boolean().optional().describe("Filter empty workspaces"),
  }),
  toArgs: ({ scope, monitor, visible, empty }) => [
    ...(scope
      ? [`--${scope}`]
      : [...option("monitor", monitor), ...toggle("visible", visible), ...toggle("empty", empty)]),
    ...format(
      "workspace",
      "workspace-is-focused",
      "workspace-is-visible",
      "monitor-id",
      "monitor-name",
      "workspace-root-container-layout",
    ),
  ],
});
