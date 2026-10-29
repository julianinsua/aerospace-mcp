import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";

export const focusBackAndForthTool = defineAerospaceTool({
  name: "focus_back_and_forth",
  command: "focus-back-and-forth",
  readOnly: true,
  description:
    "Switch focus back to the previously focused window, or empty workspace. Calling it again returns to the current one. AeroSpace remembers only one previous window, so this fails when that window has been closed; workspace_back_and_forth is the fallback.",
  inputSchema: z.object({}),
  toArgs: () => [],
});
