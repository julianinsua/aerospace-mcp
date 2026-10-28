import { z } from "zod";
import {
  boundariesSchema,
  directionSchema,
  flag,
  moveBoundariesActionSchema,
  option,
  windowIdSchema,
} from "./args.js";
import { defineTool } from "./tool.js";

export const moveWindowTool = defineTool({
  name: "move_window",
  command: "move",
  readOnly: false,
  json: false,
  description:
    "Move a window one step left, down, up or right in the AeroSpace layout tree. By default the window stays inside its workspace; set boundaries to all-monitors-outer-frame to let it cross onto the adjacent monitor. Acts on the focused window unless windowId is given.",
  inputSchema: z.object({
    direction: directionSchema,
    windowId: windowIdSchema.optional(),
    boundaries: boundariesSchema.optional(),
    boundariesAction: moveBoundariesActionSchema.optional(),
    failIfFullscreen: z
      .boolean()
      .optional()
      .describe("Exit with an error if the window is in AeroSpace fullscreen"),
    failIfMacosNativeFullscreen: z
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
    failIfFullscreen,
    failIfMacosNativeFullscreen,
  }) => [
    ...option("window-id", windowId),
    ...option("boundaries", boundaries),
    ...option("boundaries-action", boundariesAction),
    ...flag("fail-if-fullscreen", failIfFullscreen),
    ...flag("fail-if-macos-native-fullscreen", failIfMacosNativeFullscreen),
    direction,
  ],
});
