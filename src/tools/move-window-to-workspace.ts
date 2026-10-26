import { z } from "zod";
import { flag, option, stepSchema, windowIdSchema } from "./args.js";
import { defineTool } from "./tool.js";

const isStep = (target: string): target is z.infer<typeof stepSchema> =>
  stepSchema.safeParse(target).success;

export const moveWindowToWorkspaceTool = defineTool({
  name: "move_window_to_workspace",
  command: "move-node-to-workspace",
  readOnly: false,
  description:
    "Move a window to another workspace, either by workspace name or to the next or previous workspace on the focused monitor (alphabetical order). Acts on the focused window unless windowId is given.",
  inputSchema: z.object({
    target: z
      .string()
      .min(1)
      .describe(
        'Where the window should move to: a workspace name as returned by list_workspaces (for example "1" or "S"), or "next" / "prev" to step through the workspaces on the focused monitor',
      ),
    focusFollowsWindow: z
      .boolean()
      .optional()
      .describe("Focus the window after the move, so focus follows it to the new workspace"),
    wrapAround: z
      .boolean()
      .optional()
      .describe(
        'Whether the movement should wrap around. It only works when target is "next" or "prev"',
      ),
    failIfNoop: z
      .boolean()
      .optional()
      .describe(
        "Exits with a non-zero code when the window is moved to the workspace it's already on. Works only when target is a workspace name",
      ),
    windowId: windowIdSchema
      .optional()
      .describe(
        "Move a specific window, selected by id, instead of the focused one. Works only when target is a workspace name",
      ),
  }),
  toArgs: ({ target, focusFollowsWindow, wrapAround, failIfNoop, windowId }) => {
    const shared = flag("focus-follows-window", focusFollowsWindow);
    if (isStep(target)) {
      return [...shared, ...flag("wrap-around", wrapAround), target];
    }
    return [
      ...shared,
      ...flag("fail-if-noop", failIfNoop),
      ...option("window-id", windowId),
      "--",
      target,
    ];
  },
});
