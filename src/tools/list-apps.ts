import { z } from "zod";
import { format, toggle } from "./args.js";
import { defineTool } from "./tool.js";

export const listAppsTool = defineTool({
  name: "list_apps",
  command: "list-apps",
  readOnly: true,
  json: true,
  hintDestructive: false,
  description:
    "List running applications that appear in the Dock with their pid, bundle id and name. Use it to discover bundle ids for the appBundleId filter of list_windows, or pids for its pid filter.",
  inputSchema: z.object({
    macosNativeHidden: z
      .boolean()
      .optional()
      .describe(
        "true lists only apps hidden with macOS hide (cmd-h), false only the others. Omit to include both.",
      ),
  }),
  toArgs: ({ macosNativeHidden }) => [
    ...toggle("macos-native-hidden", macosNativeHidden),
    ...format("app-pid", "app-bundle-id", "app-name"),
  ],
});
