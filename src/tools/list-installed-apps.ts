import { z } from "zod";
import { defineTool, toolError } from "./tool.js";

export interface InstalledApp {
  "app-bundle-id": string;
  "app-name": string;
  "app-path": string;
}

export function parseInstalledApps(paths: string[], metadata: string[]): InstalledApp[] {
  if (metadata.length !== paths.length * 2) {
    throw new Error(
      `mdls returned ${metadata.length} values for ${paths.length} apps, expected ${paths.length * 2}`,
    );
  }
  return paths
    .map((path, i) => ({
      "app-bundle-id": metadata[2 * i],
      "app-name": metadata[2 * i + 1],
      "app-path": path,
    }))
    .filter((app) => app["app-bundle-id"] !== "(null)")
    .sort((a, b) => a["app-name"].localeCompare(b["app-name"]));
}

export const listInstalledAppsTool = defineTool({
  name: "list_installed_apps",
  description:
    "List the apps installed in /Applications and /System/Applications with their bundle id, name and path, including apps that are not running. Use list_apps for running apps only.",
  readOnly: true,
  inputSchema: z.object({}),
  async handle(_input, runners) {
    try {
      const found = await runners.mdfind.run([
        "-onlyin",
        "/Applications",
        "-onlyin",
        "/System/Applications",
        "kMDItemContentType == 'com.apple.application-bundle'",
      ]);
      if (found.code !== 0) {
        const detail = found.stderr.trim() || found.stdout.trim() || "no output";
        return toolError(`mdfind exited with code ${found.code}: ${detail}`);
      }

      const paths = found.stdout.split("\n").filter((line) => line.length > 0);
      // /System/Applications is never empty, so no results means Spotlight is not indexing.
      if (paths.length === 0) {
        return toolError(
          "mdfind found no apps in /Applications or /System/Applications. Spotlight indexing is probably off.",
        );
      }

      const metadata = await runners.mdls.run([
        "-raw",
        "-name",
        "kMDItemCFBundleIdentifier",
        "-name",
        "kMDItemDisplayName",
        ...paths,
      ]);

      if (metadata.code !== 0) {
        const detail = metadata.stderr.trim() || metadata.stdout.trim() || "no output";
        return toolError(`mdls exited with code ${metadata.code}: ${detail}`);
      }

      const apps = parseInstalledApps(paths, metadata.stdout.split("\0"));
      return { content: [{ type: "text", text: JSON.stringify(apps) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(`list_installed_apps failed: ${message}`);
    }
  },
});
