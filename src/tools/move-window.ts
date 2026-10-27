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
    "Move a window one step left, down, up or right in the AeroSpace layout tree. By default the window stays inside its workspace; set boundaries to all-monitors-outer-frame to let it cross onto the adjacent monitor. Acts on the focused window unless windowId is given.",
  inputSchema: z.object({
    direction: directionSchema,
    windowId: windowIdSchema.optional(),
    boundaries: boundariesSchema.optional(),
    boundariesAction: boundariesActionSchema.optional(),
    failIfFullScreen: z
      .boolean()
      .optional()
      .describe("Exit with an error if the window is in AeroSpace fullscreen"),
    failIfMacOSNativeFullscreen: z
      .boolean()
      .optional()
      .describe("Exit with an error if the window is in macOS native fullscreen"),
  }),
  hintDestructive: false,
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
