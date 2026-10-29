import { z } from "zod";
import { defineAerospaceTool } from "./aerospace-tool.js";
import { flag, option } from "./args.js";

export const getConfigTool = defineAerospaceTool({
  name: "get_config",
  command: "config",
  readOnly: true,
  json: true,
  description:
    'Read a value from the loaded AeroSpace config as JSON. AeroSpace 0.21 only exposes the mode tree: "mode" holds the binding modes, "mode.main.binding" maps each key binding of the main mode to its command, and "mode.main.binding.alt-1" is a single binding. Pass keys: true to list the keys of a map instead of its contents; name "." with keys lists the top-level keys. Mode ids come from list_modes. Other config sections such as gaps return an error.',
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .describe(
        'Dot-separated config key, for example "mode", "mode.main.binding" or "." for the root',
      ),
    keys: z
      .boolean()
      .optional()
      .describe("true returns only the keys of the map or array at name, not its values"),
  }),
  toArgs: ({ name, keys }) => [...option("get", name), ...flag("keys", keys)],
});
