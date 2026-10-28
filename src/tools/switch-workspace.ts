import { z } from "zod";
import { flag, isStep } from "./args.js";
import { defineTool } from "./tool.js";

export const switchWorkspaceTool = defineTool({
  name: "switch_workspace",
  command: "workspace",
  readOnly: true,
  description:
    "Focus a workspace, either by name or the next or previous workspace on the focused monitor (all workspaces, even empty ones, in alphabetical order). Switching to a name that doesn't exist yet creates an empty workspace with that name.",
  inputSchema: z
    .object({
      target: z
        .string()
        .min(1)
        .describe(
          'Workspace to focus: a name as returned by list_workspaces (for example "1" or "S"), or "next" / "prev" to step through the workspaces on the focused monitor',
        ),
      wrapAround: z
        .boolean()
        .optional()
        .describe(
          'Jump between the first and last workspaces. Only applies when target is "next" or "prev"',
        ),
      autoBackAndForth: z
        .boolean()
        .optional()
        .describe(
          "If the target workspace is already focused, go back to the previously focused workspace instead. Only applies to workspace names",
        ),
      failIfNoop: z
        .boolean()
        .optional()
        .describe(
          "Exit with an error if the target workspace is already focused. Only applies to workspace names",
        ),
    })
    .refine(({ autoBackAndForth, failIfNoop }) => !(autoBackAndForth && failIfNoop), {
      message: "autoBackAndForth and failIfNoop can't be combined",
    }),
  toArgs: ({ target, wrapAround, autoBackAndForth, failIfNoop }) => {
    if (isStep(target)) {
      return [...flag("wrap-around", wrapAround), target];
    }
    return [
      ...flag("auto-back-and-forth", autoBackAndForth),
      ...flag("fail-if-noop", failIfNoop),
      "--",
      target,
    ];
  },
});
