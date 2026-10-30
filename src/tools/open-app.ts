import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { Runner } from "../process.js";
import { defineTool, toolError } from "./tool.js";

const SECOND = 1_000;

interface AerospaceWindow {
  "window-id": number;
  "window-title": string;
  workspace: string;
}

const getWindowsList = async (
  aerospaceRunner: Runner,
  bundleId: string,
): Promise<AerospaceWindow[]> => {
  const windows = await aerospaceRunner.run([
    "list-windows",
    "--monitor",
    "all",
    "--app-bundle-id",
    bundleId,
    "--json",
    "--format",
    "%{window-id} %{window-title} %{workspace}",
  ]);

  if (windows.code !== 0) {
    const detail = windows.stderr.trim() || windows.stdout.trim() || "no output";
    throw new Error(`aerospace list-windows exited with code ${windows.code}: ${detail}`);
  }

  return JSON.parse(windows.stdout);
};

const pollWindowList = async (
  aerospaceRunner: Runner,
  bundleId: string,
  timeoutMs: number,
  windowsSnapshot: AerospaceWindow[],
) => {
  const known = new Set(windowsSnapshot.map((window) => window["window-id"]));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await getWindowsList(aerospaceRunner, bundleId);
    const added = current.filter((window) => !known.has(window["window-id"]));
    if (added.length > 0) {
      return added;
    }
    await sleep(150);
  }
  return [];
};

export const openAppTool = defineTool({
  name: "open_app",
  description:
    "Launch an app that is not running yet, wait for its first window and return the new windows with their window id, title and workspace. Find bundle ids with list_installed_apps. Apps that are already running are refused. The new window appears on the focused workspace; move it with move_window_to_workspace using the returned window id.",
  readOnly: false,
  inputSchema: z.object({
    bundleId: z
      .string()
      .regex(/^[A-Za-z0-9.-]+$/)
      .describe('Bundle id of the app to launch, for example "com.apple.calculator"'),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(30 * SECOND)
      .default(10 * SECOND)
      .describe("How long to wait for the app's first window, in milliseconds"),
  }),
  async handle({ bundleId, timeoutMs }, runners) {
    try {
      const openedBundleIdsRes = await runners.aerospace.run([
        "list-apps",
        "--json",
        "--format",
        "%{app-bundle-id}",
      ]);

      if (openedBundleIdsRes.code !== 0) {
        const detail =
          openedBundleIdsRes.stderr.trim() || openedBundleIdsRes.stdout.trim() || "no output";
        return toolError(
          `aerospace list-apps exited with code ${openedBundleIdsRes.code}: ${detail}`,
        );
      }
      const openBundleIds = JSON.parse(openedBundleIdsRes.stdout.trim()) as {
        "app-bundle-id": string;
      }[];

      const isAppRunning = openBundleIds.some((a) => a["app-bundle-id"] === bundleId);
      if (isAppRunning) {
        return toolError(
          `${bundleId} is already running; open_app only launches apps that are not running yet`,
        );
      }

      const windowsSnapshot = await getWindowsList(runners.aerospace, bundleId);
      const openRes = await runners.open.run(["-g", "-b", bundleId]);
      if (openRes.code !== 0) {
        const details = openRes.stderr.trim() || openRes.stdout.trim() || "no output";
        return toolError(`open exited with code ${openRes.code}: ${details}`);
      }

      const openedWindows = await pollWindowList(
        runners.aerospace,
        bundleId,
        timeoutMs,
        windowsSnapshot,
      );
      if (openedWindows.length === 0) {
        return toolError(`launched ${bundleId} but no window appeared within ${timeoutMs}ms`);
      }
      return { content: [{ type: "text", text: JSON.stringify(openedWindows) }] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return toolError(`open_app failed: ${message}`);
    }
  },
});
