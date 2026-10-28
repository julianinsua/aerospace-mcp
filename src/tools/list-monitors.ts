import { z } from "zod";
import { format, toggle } from "./args.js";
import { defineTool } from "./tool.js";

const LIST_MONITORS_FORMAT = ["monitor-id", "monitor-name", "monitor-is-main"];

export const listMonitorsTool = defineTool({
  name: "list_monitors",
  command: "list-monitors",
  readOnly: true,
  json: true,
  description:
    "List monitors with their id, name and whether each is the macOS main display. Use the id with the monitor arguments of list_workspaces and list_windows.",
  inputSchema: z.object({
    focused: z
      .boolean()
      .optional()
      .describe(
        "true lists only the focused monitor, false only the others. Omit to include both.",
      ),
    mouse: z
      .boolean()
      .optional()
      .describe(
        "true lists only the monitor under the mouse, false only the others. Omit to include both.",
      ),
  }),
  toArgs: ({ focused, mouse }) => {
    return [
      ...toggle("focused", focused),
      ...toggle("mouse", mouse),
      ...format(...LIST_MONITORS_FORMAT),
    ];
  },
});
