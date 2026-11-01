import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { KNOWN_APPS, NEW_WINDOW_COMMANDS } from "../consts/open-commands.js";
import { exitFailure, type Runner } from "../process.js";
import type { Runners } from "../runners.js";
import { dictionaryLookup } from "../utils/scripting-dictionary.js";
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
    throw new Error(exitFailure("aerospace list-windows", windows));
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

type RunningApp = {
  "app-bundle-id": string;
  "app-bundle-path": string;
};

const openNonRunningApp = async (openRunner: Runner, bundleId: string): Promise<void> => {
  const openRes = await openRunner.run(["-g", "-b", bundleId]);
  if (openRes.code !== 0) {
    throw new Error(exitFailure("open", openRes));
  }
};

const openRunningApp = async (
  runners: Runners,
  bundleId: string,
  runningApp: RunningApp,
): Promise<void> => {
  const kind = Object.hasOwn(KNOWN_APPS, bundleId)
    ? KNOWN_APPS[bundleId]
    : await dictionaryLookup(runners, runningApp["app-bundle-path"]);

  if (!kind) {
    throw new Error(`${bundleId} is already running and has no known way to open a new window.`);
  }

  const commandArgs = [
    "-e",
    "on run argv",
    "-e",
    `tell application id (item 1 of argv) to ${NEW_WINDOW_COMMANDS[kind]}`,
    "-e",
    "end run",
    bundleId,
  ];

  const runScriptRes = await runners.osascript.run(commandArgs);
  if (runScriptRes.code !== 0) {
    const errorCode = runScriptRes.stderr.match(/\((-?\d+)\)\s*$/)?.[1];
    switch (errorCode) {
      case "-1743":
        throw new Error(
          `macOS refused to let this server control ${bundleId}. The user has to allow it under System Settings > Privacy & Security > Automation.`,
        );
      case "-600":
        throw new Error(
          `${bundleId} quit before a new window could be opened. Call open_app again to launch it.`,
        );
      default:
        throw new Error(exitFailure("osascript", runScriptRes));
    }
  }
};

const openWindow = async (
  runners: Runners,
  bundleId: string,
  runningApp?: RunningApp,
): Promise<void> => {
  if (!runningApp) {
    return openNonRunningApp(runners.open, bundleId);
  }
  return openRunningApp(runners, bundleId, runningApp);
};

export const openAppTool = defineTool({
  name: "open_app",
  description:
    "Open a new window of an app and return the new windows with their window id, title and workspace. Launches the app if it is not running; if it is running, asks it for a new window, which works only for apps with a supported AppleScript command. Find bundle ids with list_installed_apps. The new window appears on the focused workspace; move it with move_window_to_workspace using the returned window id.",
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
      .describe("How long to wait for a new window, in milliseconds"),
  }),
  async handle({ bundleId, timeoutMs }, runners) {
    try {
      const runningAppsRes = await runners.aerospace.run([
        "list-apps",
        "--json",
        "--format",
        "%{app-bundle-id} %{app-bundle-path}",
      ]);

      if (runningAppsRes.code !== 0) {
        return toolError(exitFailure("aerospace list-apps", runningAppsRes));
      }

      const runningApps = JSON.parse(runningAppsRes.stdout.trim()) as RunningApp[];

      const runningApp = runningApps.find((a) => a["app-bundle-id"] === bundleId);

      const openWindowsSnapshot = await getWindowsList(runners.aerospace, bundleId);
      await openWindow(runners, bundleId, runningApp);

      const openedWindows = await pollWindowList(
        runners.aerospace,
        bundleId,
        timeoutMs,
        openWindowsSnapshot,
      );

      if (openedWindows.length === 0) {
        const action = runningApp ? `asked ${bundleId} for a new window` : `launched ${bundleId}`;
        return toolError(`${action} but no window appeared within ${timeoutMs}ms`);
      }

      return { content: [{ type: "text", text: JSON.stringify(openedWindows) }] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return toolError(`open_app failed: ${message}`);
    }
  },
});
