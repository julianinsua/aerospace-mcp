import { z } from "zod";
import { format, monitorSchema, option, scopeSchema, workspaceSchema } from "./args.js";
import { defineTool } from "./tool.js";

export const listWindowsTool = defineTool({
  name: "list_windows",
  command: "list-windows",
  readOnly: true,
  json: true,
  description:
    "List AeroSpace windows with their window id, app name, bundle id, pid, title, fullscreen state, workspace and monitor. Filters combine. With no monitor or workspace, only windows on the focused monitor are listed. Use the window id with the move tools.",
  inputSchema: z.object({
    scope: scopeSchema
      .optional()
      .describe(
        "Shortcut that overrides every other filter: all lists the windows on every monitor, focused returns only the focused window (an error if no window has focus)",
      ),
    monitor: monitorSchema.optional(),
    workspace: workspaceSchema.optional(),
    pid: z.number().int().optional().describe("Only windows owned by this process id"),
    appBundleId: z
      .string()
      .optional()
      .describe('Only windows of the app with this bundle id, for example "com.google.Chrome"'),
  }),
  hintDestructive: false,
  toArgs: ({ scope, monitor, workspace, pid, appBundleId }) => [
    ...(scope
      ? [`--${scope}`]
      : [
          ...option("monitor", monitor ?? (workspace === undefined ? "focused" : undefined)),
          ...option("workspace", workspace),
          ...option("pid", pid),
          ...option("app-bundle-id", appBundleId),
        ]),
    ...format(
      "window-id",
      "app-name",
      "app-bundle-id",
      "app-pid",
      "window-title",
      "window-is-fullscreen",
      "workspace",
      "monitor-id",
    ),
  ],
});
