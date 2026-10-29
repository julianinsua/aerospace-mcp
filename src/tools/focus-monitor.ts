import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";
import { monitorTargetArgs, monitorTargetSchema } from "./args.js";

export const focusMonitorTool = defineAerospaceTool({
  name: "focus_monitor",
  command: "focus-monitor",
  readOnly: true,
  description:
    "Focus a monitor: the neighbor in a direction, the next or previous monitor, or a specific monitor by id from list_monitors or by name pattern.",
  inputSchema: z.object({
    target: monitorTargetSchema.describe(
      'Monitor to focus: left, down, up or right relative to the focused monitor; next or prev in the order they appear in the menu bar icon; a monitor-id from list_monitors (1-based, left to right); main or secondary; or a case-insensitive regex matched against the monitor name (for example "dell")',
    ),
    wrapAround: z
      .boolean()
      .optional()
      .describe(
        "Wrap around from the last monitor to the first. Only applies to directions and next / prev",
      ),
  }),
  toArgs: ({ target, wrapAround }) => monitorTargetArgs(target, wrapAround),
});
