import { z } from "zod";
import { flag, workspaceSchema } from "./args.js";
import { defineTool } from "./tool.js";

export const summonWorkspaceTool = defineTool({
  name: "summon_workspace",
  command: "summon-workspace",
  readOnly: false,
  description:
    "Move a workspace to the focused monitor and focus it, taking it away from the monitor it was on. With a single monitor it behaves like switch_workspace.",
  inputSchema: z.object({
    workspace: workspaceSchema.describe(
      'Workspace to bring to the focused monitor, by name as returned by list_workspaces (for example "1" or "S")',
    ),
    failIfNoop: z
      .boolean()
      .optional()
      .describe("Exit with an error if the workspace is already visible on the focused monitor"),
  }),
  toArgs: ({ workspace, failIfNoop }) => [...flag("fail-if-noop", failIfNoop), "--", workspace],
});
