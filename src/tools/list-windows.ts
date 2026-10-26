import { z } from "zod";
import { format, monitorSchema, option, scopeSchema, workspaceSchema } from "./args.js";
import { defineTool } from "./tool.js";

export const listWindowsTool = defineTool({
  name: "list_windows",
  command: "list-windows",
  readOnly: true,
  description:
    "List AeroSpace windows. scope all lists every workspace; focused lists the workspace that has focus. monitor targets the workspaces visible in current monitors.",
  inputSchema: z.object({
    scope: scopeSchema.optional().describe("Use a shortcut to select windows"),
    monitor: monitorSchema.optional(),
    workspace: workspaceSchema.optional(),
    pid: z.number().optional(),
    appBundleId: z.string().optional(),
  }),
  toArgs: ({ scope, monitor, workspace, pid, appBundleId }) => [
    ...(scope
      ? [`--${scope}`]
      : [
          ...option("monitor", monitor),
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
