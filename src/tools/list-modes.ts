import { z } from "zod";
import { flag } from "./args.js";
import { defineTool } from "./tool.js";

export const listModesTool = defineTool({
  name: "list_modes",
  command: "list-modes",
  readOnly: true,
  json: true,
  description:
    "List the binding modes defined in the AeroSpace config, each as a mode id such as main. Pass current to get only the active mode. Use get_config with mode.<id>.binding to see a mode's key bindings.",
  inputSchema: z.object({
    current: z.boolean().optional().describe("true returns only the currently active mode"),
  }),
  toArgs: ({ current }) => flag("current", current),
});
