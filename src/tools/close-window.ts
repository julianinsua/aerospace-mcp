import { z } from "zod";
import { flag, option, windowIdSchema } from "./args.js";
import { defineTool } from "./tool.js";

export const closeWindowTool = defineTool({
  name: "close_window",
  command: "close",
  readOnly: false,
  hintDestructive: true,
  description:
    "Close a window, as cmd+w would. Acts on the focused window unless windowId is given; prefer passing a windowId from list_windows so a focus change can't close the wrong window.",
  inputSchema: z.object({
    quitIfLastWindow: z
      .boolean()
      .optional()
      .describe("If this is the app's last window, quit the whole app instead of only closing it"),
    windowId: windowIdSchema.optional(),
  }),
  toArgs: ({ windowId, quitIfLastWindow }) => {
    const shared = flag("quit-if-last-window", quitIfLastWindow);

    return [...shared, ...option("window-id", windowId)];
  },
});
