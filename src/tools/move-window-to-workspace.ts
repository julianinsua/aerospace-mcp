import { z } from "zod";
import { flag, option, stepSchema, windowIdSchema } from "./args.js";
import { defineTool } from "./tool.js";

export const moveWindowToWorkspaceTool = defineTool({
  name: "move_window_to_workspace",
  command: "move-node-to-workspace",
  readOnly: false,
  description: "Move the focused window to a specified workspace",
  inputSchema: z.object({
    target: z
      .xor([z.number(), stepSchema])
      .describe(
        'Where the window should move to: either the workspace number or a direction ("next" or "prev")',
      ),
    focusFollowsWindow: z.boolean().optional(),
    wrapAround: z
      .boolean()
      .optional()
      .describe(
        'Whether the movement should wrap around. It only works when target uses a step argument ("next" or "prev")',
      ),
    failIfNoop: z
      .boolean()
      .optional()
      .describe(
        "Exits with a non-zero code when the window is moved to the workspace it's already on. Works only when target uses a number (workspace name)",
      ),
    windowId: windowIdSchema
      .optional()
      .describe(
        "Move a specific window, selected by id, instead of the focused one. Works only when target uses a number (workspace name)",
      ),
  }),
  toArgs: ({ target, focusFollowsWindow, wrapAround, failIfNoop, windowId }) => {
    const shared = flag("focus-follows-window", focusFollowsWindow);
    if (typeof target === "number") {
      return [
        ...shared,
        ...flag("fail-if-noop", failIfNoop),
        ...option("window-id", windowId),
        String(target),
      ];
    }
    return [...shared, ...flag("wrap-around", wrapAround), target];
  },
});
