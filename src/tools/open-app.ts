import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { Config, Opener } from "../config.js";
import { KNOWN_APPS } from "../consts/open-commands.js";
import { exitFailure, type Runner } from "../process.js";
import type { Runners } from "../runners.js";
import { fill } from "../utils/fill.js";
import { dictionaryLookup } from "../utils/scripting-dictionary.js";
import { flag, option } from "./args.js";
import { defineTool, toolError } from "./tool.js";

const SECOND = 1_000;
const SETTLE_TIME = 500;

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
  expectManyWindows: boolean,
) => {
  const known = new Set(windowsSnapshot.map((window) => window["window-id"]));
  const hardDeadline = Date.now() + timeoutMs;
  let deadline = hardDeadline;
  const openedWindows: AerospaceWindow[] = [];
  while (Date.now() < deadline) {
    const current = await getWindowsList(aerospaceRunner, bundleId);
    const added = current.filter((window) => !known.has(window["window-id"]));
    if (added.length > 0) {
      for (const item of added) {
        openedWindows.push(item);
        known.add(item["window-id"]);
      }
      if (!expectManyWindows) {
        return openedWindows;
      }
      deadline = Math.min(Date.now() + SETTLE_TIME, hardDeadline);
    }
    await sleep(150);
  }
  return openedWindows;
};

type RunningApp = {
  "app-bundle-id": string;
  "app-bundle-path": string;
  "app-pid": number;
};

const openNonRunningApp = async (openRunner: Runner, bundleId: string): Promise<void> => {
  const openRes = await openRunner.run(["-g", "-b", bundleId]);
  if (openRes.code !== 0) {
    throw new Error(exitFailure("open", openRes));
  }
};

export async function runOpener(
  opener: Opener,
  runners: Runners,
  runningApp: RunningApp,
): Promise<void> {
  const ctx = { bundlePath: runningApp["app-bundle-path"], pid: runningApp["app-pid"] };
  switch (opener.type) {
    case "applescript": {
      const osascriptRes = await runners.osascript.run([
        "-e",
        "on run argv",
        "-e",
        `tell application id (item 1 of argv) to ${opener.command}`,
        "-e",
        "end run",
        runningApp["app-bundle-id"],
      ]);

      if (osascriptRes.code !== 0) {
        const errorCode = osascriptRes.stderr.match(/\((-?\d+)\)\s*$/)?.[1];
        switch (errorCode) {
          case "-1743":
            throw new Error(
              `macOS refused to let this server control ${runningApp["app-bundle-id"]}. The user has to allow it under System Settings > Privacy & Security > Automation.`,
            );
          case "-600":
            throw new Error(
              `${runningApp["app-bundle-id"]} quit before a new window could be opened. Call open_app again to launch it.`,
            );
          default:
            throw new Error(exitFailure("osascript", osascriptRes));
        }
      }
      break;
    }
    case "exec": {
      const bin = fill(ctx, opener.bin);
      if (!bin.startsWith("/")) {
        throw new Error(
          `opener bin for ${runningApp["app-bundle-id"]} must be an absolute path, got ${bin}`,
        );
      }
      const execRes = await runners.exec(bin).run(opener.args.map((a) => fill(ctx, a)));
      if (execRes.code !== 0) {
        throw new Error(exitFailure(bin, execRes));
      }
      break;
    }
    case "newInstance": {
      const openRes = await runners.open.run([
        "-n",
        "-g",
        "-b",
        runningApp["app-bundle-id"],
        "--args",
        ...opener.args.map((a) => fill(ctx, a)),
      ]);
      if (openRes.code !== 0) {
        throw new Error(exitFailure("open", openRes));
      }
      break;
    }
    default: {
      const unreachable: never = opener;
      throw new Error(`unknown opener type: ${JSON.stringify(unreachable)}`);
    }
  }
}

const openRunningApp = async (
  runners: Runners,
  bundleId: string,
  runningApp: RunningApp,
  config: Config,
): Promise<void> => {
  const mergedOpeners = { ...KNOWN_APPS, ...config.openers };
  const appOpener = Object.hasOwn(mergedOpeners, bundleId)
    ? mergedOpeners[bundleId]
    : await dictionaryLookup(runners, runningApp["app-bundle-path"]);

  if (!appOpener) {
    throw new Error(`${bundleId} is already running and has no known way to open a new window.`);
  }

  await runOpener(appOpener, runners, runningApp);
};

const openWindow = async (
  runners: Runners,
  bundleId: string,
  config: Config,
  runningApp?: RunningApp,
): Promise<void> => {
  if (!runningApp) {
    return openNonRunningApp(runners.open, bundleId);
  }
  return openRunningApp(runners, bundleId, runningApp, config);
};

const moveWindowsToWorkspace = async (
  aerospaceRunner: Runner,
  openedWindows: AerospaceWindow[],
  workspace: string,
  focusFollowsWindow?: boolean,
): Promise<string[]> => {
  const errors: string[] = [];
  for (const [i, w] of openedWindows.entries()) {
    const moveWindowRes = await aerospaceRunner.run([
      "move-node-to-workspace",
      ...option("window-id", w["window-id"]),
      ...(i === openedWindows.length - 1 ? flag("focus-follows-window", focusFollowsWindow) : []),
      "--",
      workspace,
    ]);
    if (moveWindowRes.code !== 0) {
      errors.push(exitFailure("aerospace move-node-to-workspace", moveWindowRes));
    }
  }
  return errors;
};

export const openAppTool = defineTool({
  name: "open_app",
  description:
    "Open a new window of an app and return the new windows with their window id, title and workspace. Launches the app if it is not running; if it is running, asks it for a new window, which works only for apps with a known way to open one. Find bundle ids with list_installed_apps. New windows appear on the focused workspace unless workspace is given, in which case they are moved there and may briefly show on the focused workspace first.",
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
    workspace: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Workspace to move the new windows to, by name as returned by list_workspaces (for example "1" or "S"). Defaults to leaving them on the focused workspace',
      ),
    focusFollowsWindow: z
      .boolean()
      .optional()
      .describe(
        "Focus the new window after the move, so focus follows it to the new workspace. Works only when workspace is given",
      ),
  }),
  async handle({ bundleId, timeoutMs, workspace, focusFollowsWindow }, runners, config) {
    try {
      const runningAppsRes = await runners.aerospace.run([
        "list-apps",
        "--json",
        "--format",
        "%{app-bundle-id} %{app-bundle-path} %{app-pid}",
      ]);

      if (runningAppsRes.code !== 0) {
        return toolError(exitFailure("aerospace list-apps", runningAppsRes));
      }

      const runningApps = JSON.parse(runningAppsRes.stdout.trim()) as RunningApp[];

      const runningApp = runningApps.find((a) => a["app-bundle-id"] === bundleId);

      const openWindowsSnapshot = await getWindowsList(runners.aerospace, bundleId);
      await openWindow(runners, bundleId, config, runningApp);

      const openedWindows = await pollWindowList(
        runners.aerospace,
        bundleId,
        timeoutMs,
        openWindowsSnapshot,
        runningApp === undefined,
      );

      if (openedWindows.length === 0) {
        const action = runningApp ? `asked ${bundleId} for a new window` : `launched ${bundleId}`;
        return toolError(`${action} but no window appeared within ${timeoutMs}ms`);
      }

      if (!workspace) {
        return { content: [{ type: "text", text: JSON.stringify(openedWindows) }] };
      }

      const errors = await moveWindowsToWorkspace(
        runners.aerospace,
        openedWindows,
        workspace,
        focusFollowsWindow,
      );
      if (errors.length > 0) {
        const ids = openedWindows.map((w) => w["window-id"]).join(", ");
        return toolError(
          `opened ${bundleId} windows ${ids} but could not move them all to workspace ${workspace}: ${errors.join("; ")}`,
        );
      }

      const moved = openedWindows.map((w) => ({ ...w, workspace }));
      return { content: [{ type: "text", text: JSON.stringify(moved) }] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return toolError(`open_app failed: ${message}`);
    }
  },
});
