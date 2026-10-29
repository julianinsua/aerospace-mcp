import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";

export const workspaceBackAndForthTool = defineAerospaceTool({
  name: "workspace_back_and_forth",
  command: "workspace-back-and-forth",
  readOnly: true,
  description:
    "Switch back to the previously focused workspace. Calling it again returns to the current one.",
  inputSchema: z.object({}),
  toArgs: () => [],
});
