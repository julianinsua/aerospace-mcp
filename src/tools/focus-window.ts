import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";
import {
  boundariesSchema,
  dfsStepSchema,
  directionSchema,
  flag,
  focusBoundariesActionSchema,
  option,
  windowIdSchema,
} from "./args.js";

const isDfsStep = (target: string): target is z.infer<typeof dfsStepSchema> =>
  dfsStepSchema.safeParse(target).success;

export const focusWindowTool = defineAerospaceTool({
  name: "focus_window",
  command: "focus",
  readOnly: true,
  description:
    "Focus a window: the neighbor in a direction (left, down, up, right), the next or previous window in tree order (dfs-next, dfs-prev), a window by id from list_windows, or a window by its 0-based position in the focused workspace's tree. Pass exactly one of target, windowId or dfsIndex.",
  inputSchema: z
    .object({
      target: z
        .enum([...directionSchema.options, ...dfsStepSchema.options])
        .optional()
        .describe(
          "Direction to move focus in, or dfs-next / dfs-prev for the next or previous window in depth-first tree order",
        ),
      windowId: windowIdSchema.optional().describe("Focus this window. Ids come from list_windows"),
      dfsIndex: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Focus the window at this 0-based position in a depth-first walk of the focused workspace's tree",
        ),
      boundaries: boundariesSchema
        .optional()
        .describe(
          "How far focus may travel. workspace (the default) stays inside the focused workspace. all-monitors-outer-frame lets a direction cross onto the adjacent monitor",
        ),
      boundariesAction: focusBoundariesActionSchema.optional(),
      ignoreFloating: z
        .boolean()
        .optional()
        .describe("Skip floating windows, so only tiled windows can receive focus"),
      failIfFullscreen: z
        .boolean()
        .optional()
        .describe(
          "Exit with an error if the focused window is in AeroSpace fullscreen. Direction targets only",
        ),
      failIfMacosNativeFullscreen: z
        .boolean()
        .optional()
        .describe(
          "Exit with an error if the focused window is in macOS native fullscreen. Direction targets only",
        ),
    })
    .refine(
      ({ target, windowId, dfsIndex }) =>
        [target, windowId, dfsIndex].filter((value) => value !== undefined).length === 1,
      { message: "Pass exactly one of target, windowId or dfsIndex" },
    )
    .refine(
      ({ target, ...options }) =>
        target !== undefined ||
        [
          options.boundaries,
          options.boundariesAction,
          options.ignoreFloating,
          options.failIfFullscreen,
          options.failIfMacosNativeFullscreen,
        ].every((value) => value === undefined),
      { message: "windowId and dfsIndex take no other options" },
    )
    .refine(
      ({ target, boundaries, boundariesAction }) =>
        target === undefined ||
        !isDfsStep(target) ||
        (boundaries !== "all-monitors-outer-frame" &&
          boundariesAction !== "wrap-around-all-monitors"),
      {
        message:
          "dfs-next and dfs-prev stay inside the workspace: boundaries must be workspace and boundariesAction can't be wrap-around-all-monitors",
      },
    )
    .refine(
      ({ target, failIfFullscreen, failIfMacosNativeFullscreen }) =>
        target === undefined ||
        !isDfsStep(target) ||
        (failIfFullscreen === undefined && failIfMacosNativeFullscreen === undefined),
      {
        message:
          "failIfFullscreen and failIfMacosNativeFullscreen only apply to left, down, up and right",
      },
    ),
  toArgs: ({
    target,
    windowId,
    dfsIndex,
    boundaries,
    boundariesAction,
    ignoreFloating,
    failIfFullscreen,
    failIfMacosNativeFullscreen,
  }) => {
    if (windowId !== undefined) {
      return option("window-id", windowId);
    }
    if (dfsIndex !== undefined) {
      return option("dfs-index", dfsIndex);
    }
    return [
      ...flag("ignore-floating", ignoreFloating),
      ...option("boundaries", boundaries),
      ...option("boundaries-action", boundariesAction),
      ...flag("fail-if-fullscreen", failIfFullscreen),
      ...flag("fail-if-macos-native-fullscreen", failIfMacosNativeFullscreen),
      ...(target === undefined ? [] : [target]),
    ];
  },
});
