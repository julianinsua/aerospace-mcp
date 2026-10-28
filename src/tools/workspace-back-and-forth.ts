import { z } from "zod";
import { defineTool } from "./tool.js";

export const workspaceBackAndForthTool = defineTool({
  name: "workspace_back_and_forth",
  command: "workspace-back-and-forth",
  readOnly: true,
  json: false,
  hintDestructive: false,
  description:
    "Switch back to the previously focused workspace. Calling it again returns to the current one.",
  inputSchema: z.object({}),
  toArgs: () => [],
});
