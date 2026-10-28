import { z } from "zod";
import { format, monitorSchema, option, scopeSchema, toggle } from "./args.js";
import { defineTool } from "./tool.js";

export const listWorkspacesTool = defineTool({
  name: "list_workspaces",
  command: "list-workspaces",
  readOnly: true,
  json: true,
  description:
    "List AeroSpace workspaces with their name, whether each is focused or visible, the monitor it is on, and its root layout. By default only workspaces on the focused monitor are listed; pass monitor all to include every monitor. Workspace names are strings; use them as-is in other tools.",
  inputSchema: z.object({
    scope: scopeSchema
      .optional()
      .describe(
        "Shortcut that overrides monitor, visible and empty: all lists the workspaces on every monitor, focused lists only the focused workspace",
      ),
    monitor: monitorSchema.default("focused"),
    visible: z
      .boolean()
      .optional()
      .describe(
        "true lists only visible workspaces, false only hidden ones. Omit to include both. With several monitors, several workspaces are visible",
      ),
    empty: z
      .boolean()
      .optional()
      .describe(
        "true lists only workspaces without windows, false only those with windows. Omit to include both",
      ),
  }),
  hintDestructive: false,
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
