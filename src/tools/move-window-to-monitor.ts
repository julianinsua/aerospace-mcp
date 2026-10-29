import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";
import {
  flag,
  isDirection,
  isStep,
  monitorTargetArgs,
  monitorTargetSchema,
  option,
  windowIdSchema,
} from "./args.js";

export const moveWindowToMonitorTool = defineAerospaceTool({
  name: "move_window_to_monitor",
  command: "move-node-to-monitor",
  readOnly: false,
  description:
    "Move a window to another monitor: the neighbor in a direction, the next or previous monitor, or a specific monitor by id from list_monitors or by name pattern. The window lands on the workspace currently visible on that monitor. Acts on the focused window unless windowId is given.",
  inputSchema: z.object({
    target: monitorTargetSchema.describe(
      'Monitor to move the window to: left, down, up or right relative to the focused monitor; next or prev in the order they appear in the menu bar icon; a monitor-id from list_monitors (1-based, left to right); main or secondary; or a case-insensitive regex matched against the monitor name (for example "dell")',
    ),
    windowId: windowIdSchema
      .optional()
      .describe(
        "Move a specific window, selected by id from list_windows, instead of the focused one",
      ),
    focusFollowsWindow: z
      .boolean()
      .optional()
      .describe("Focus the window after the move, so focus follows it to the new monitor"),
    wrapAround: z
      .boolean()
      .optional()
      .describe(
        "Wrap around between the first and last monitors. Only applies to directions and next / prev",
      ),
    failIfNoop: z
      .boolean()
      .optional()
      .describe(
        "Exits with a non-zero code when the window is already on the target monitor. Only applies to a monitor id, main / secondary or a name pattern",
      ),
  }),
  toArgs: ({ target, windowId, focusFollowsWindow, wrapAround, failIfNoop }) => {
    const relative = isDirection(target) || isStep(target);
    return [
      ...option("window-id", windowId),
      ...flag("focus-follows-window", focusFollowsWindow),
      ...(relative ? [] : flag("fail-if-noop", failIfNoop)),
      ...monitorTargetArgs(target, wrapAround),
    ];
  },
});
