import { z } from "zod";
import {
  boundariesActionSchema,
  boundariesSchema,
  directionSchema,
  flag,
  option,
  windowIdSchema,
} from "./args.js";
import { defineTool } from "./tool.js";

export const moveWindowTool = defineTool({
  name: "move_window",
  command: "move",
  readOnly: false,
  description:
    "Move the focused window within the current workspace or within the outer frame of all monitors.",
  inputSchema: z.object({
    direction: directionSchema,
    windowId: windowIdSchema.optional(),
    boundaries: boundariesSchema.optional(),
    boundariesAction: boundariesActionSchema.optional(),
    failIfFullScreen: z.boolean().optional(),
    failIfMacOSNativeFullscreen: z.boolean().optional(),
  }),
  toArgs: ({
    direction,
    windowId,
    boundaries,
    boundariesAction,
    failIfFullScreen,
    failIfMacOSNativeFullscreen,
  }) => [
    ...option("window-id", windowId),
    ...option("boundaries", boundaries),
    ...option("boundaries-action", boundariesAction),
    ...flag("fail-if-fullscreen", failIfFullScreen),
    ...flag("fail-if-macos-native-fullscreen", failIfMacOSNativeFullscreen),
    direction,
  ],
});
