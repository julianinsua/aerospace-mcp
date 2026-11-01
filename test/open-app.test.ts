import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../src/process.js";
import { openAppTool } from "../src/tools/open-app.js";
import { recordingRunner, runnersWith, sequenceRunner } from "./runners.js";

const ok = (stdout = ""): RunResult => ({ code: 0, stdout, stderr: "" });
const failed = (stderr: string): RunResult => ({ code: 1, stdout: "", stderr });

const runningApps = (apps: Array<[id: string, path: string]>) =>
  ok(JSON.stringify(apps.map(([id, path]) => ({ "app-bundle-id": id, "app-bundle-path": path }))));
const windows = (...ids: number[]) =>
  ok(
    JSON.stringify(
      ids.map((id) => ({ "window-id": id, "window-title": `window ${id}`, workspace: "1" })),
    ),
  );

const LIST_APPS_ARGS = ["list-apps", "--json", "--format", "%{app-bundle-id} %{app-bundle-path}"];
const listWindowsArgs = (bundleId: string) => [
  "list-windows",
  "--monitor",
  "all",
  "--app-bundle-id",
  bundleId,
  "--json",
  "--format",
  "%{window-id} %{window-title} %{workspace}",
];
const scriptArgs = (bundleId: string, command: string) => [
  "-e",
  "on run argv",
  "-e",
  `tell application id (item 1 of argv) to ${command}`,
  "-e",
  "end run",
  bundleId,
];

function text(result: Awaited<ReturnType<typeof openAppTool.handle>>): string {
  const [item] = result.content;
  return item?.type === "text" ? item.text : "";
}

const open = (
  bundleId: string,
  runners: Parameters<typeof openAppTool.handle>[1],
  timeoutMs = 1000,
) => openAppTool.handle(openAppTool.inputSchema.parse({ bundleId, timeoutMs }), runners);

describe("open_app input", () => {
  it.each(["com.apple.calculator;ls", "com apple", ""])("rejects the bundle id %j", (bundleId) => {
    expect(openAppTool.inputSchema.safeParse({ bundleId }).success).toBe(false);
  });

  it.each([0, 1.5, 30_001])("rejects timeoutMs %j", (timeoutMs) => {
    expect(
      openAppTool.inputSchema.safeParse({ bundleId: "com.apple.calculator", timeoutMs }).success,
    ).toBe(false);
  });

  it("waits 10 seconds by default", () => {
    expect(openAppTool.inputSchema.parse({ bundleId: "com.apple.calculator" }).timeoutMs).toBe(
      10_000,
    );
  });
});

describe("open_app for an app that is not running", () => {
  it("launches it in the background and returns its first window", async () => {
    const aerospace = sequenceRunner([
      runningApps([["com.apple.finder", "/System/Library/CoreServices/Finder.app"]]),
      windows(),
      windows(7),
    ]);
    const openRunner = recordingRunner();

    const result = await open("com.apple.calculator", runnersWith({ aerospace, open: openRunner }));

    expect(aerospace.calls).toEqual([
      LIST_APPS_ARGS,
      listWindowsArgs("com.apple.calculator"),
      listWindowsArgs("com.apple.calculator"),
    ]);
    expect(openRunner.calls).toEqual([["-g", "-b", "com.apple.calculator"]]);
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(text(result))).toEqual([
      { "window-id": 7, "window-title": "window 7", workspace: "1" },
    ]);
  });

  it("reports a bundle id that open cannot find", async () => {
    const aerospace = sequenceRunner([runningApps([]), windows()]);
    const openRunner = recordingRunner(
      failed("Unable to find application with bundle identifier com.example.missing\n"),
    );

    const result = await open("com.example.missing", runnersWith({ aerospace, open: openRunner }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe(
      "open_app failed: open exited with code 1: Unable to find application with bundle identifier com.example.missing",
    );
  });

  it("reports a launch without a window before the timeout", async () => {
    const aerospace = sequenceRunner([runningApps([]), windows()]);

    const result = await open(
      "com.apple.calculator",
      runnersWith({ aerospace, open: recordingRunner() }),
      1,
    );

    expect(result.isError).toBe(true);
    expect(text(result)).toBe("launched com.apple.calculator but no window appeared within 1ms");
  });
});

describe("open_app for a running app", () => {
  it.each([
    ["com.google.Chrome", "make new window"],
    ["com.apple.Safari", "make new document"],
    ["com.apple.finder", "make new «class brow»"],
    ["com.apple.Terminal", '«event coredosc» ""'],
  ])("runs the known command for %s and returns only the new window", async (bundleId, command) => {
    const aerospace = sequenceRunner([
      runningApps([[bundleId, "/Applications/App.app"]]),
      windows(3),
      windows(3, 9),
    ]);
    const osascript = recordingRunner();

    const result = await open(bundleId, runnersWith({ aerospace, osascript }));

    expect(osascript.calls).toEqual([scriptArgs(bundleId, command)]);
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(text(result))).toEqual([
      { "window-id": 9, "window-title": "window 9", workspace: "1" },
    ]);
  });

  it("finds the command in the app's scripting dictionary", async () => {
    const root = await mkdtemp(join(tmpdir(), "aerospace-mcp-open-"));
    try {
      const appPath = join(root, "Writer.app");
      await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
      await writeFile(
        join(appPath, "Contents", "Resources", "Writer.sdef"),
        '<dictionary><class name="application"><element type="document"/></class></dictionary>',
      );
      const aerospace = sequenceRunner([
        runningApps([["com.example.writer", appPath]]),
        windows(),
        windows(4),
      ]);
      const plutil = recordingRunner(ok("Writer.sdef\n"));
      const osascript = recordingRunner();

      const result = await open(
        "com.example.writer",
        runnersWith({ aerospace, plutil, osascript }),
      );

      expect(osascript.calls).toEqual([scriptArgs("com.example.writer", "make new document")]);
      expect(result.isError).not.toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["com.tinyspeck.slackmacgap", "constructor"])(
    "refuses %s without a known command",
    async (bundleId) => {
      const aerospace = sequenceRunner([
        runningApps([[bundleId, "/Applications/App.app"]]),
        windows(2),
      ]);
      const plutil = recordingRunner(failed("Could not extract value\n"));

      const result = await open(bundleId, runnersWith({ aerospace, plutil }));

      expect(result.isError).toBe(true);
      expect(text(result)).toBe(
        `open_app failed: ${bundleId} is already running and has no known way to open a new window.`,
      );
    },
  );

  it.each([
    [
      "execution error: Not authorized to send Apple events to Finder. (-1743)\n",
      "open_app failed: macOS refused to let this server control com.apple.finder. The user has to allow it under System Settings > Privacy & Security > Automation.",
    ],
    [
      "execution error: Application isn't running. (-600)\n",
      "open_app failed: com.apple.finder quit before a new window could be opened. Call open_app again to launch it.",
    ],
    [
      "68:74: syntax error: Expected end of line but found class name. (-2741)\n",
      "open_app failed: osascript exited with code 1: 68:74: syntax error: Expected end of line but found class name. (-2741)",
    ],
  ])("maps the osascript error %j", async (stderr, message) => {
    const aerospace = sequenceRunner([
      runningApps([["com.apple.finder", "/System/Library/CoreServices/Finder.app"]]),
      windows(),
    ]);
    const osascript = recordingRunner(failed(stderr));

    const result = await open("com.apple.finder", runnersWith({ aerospace, osascript }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe(message);
  });

  it("reports a request without a new window before the timeout", async () => {
    const aerospace = sequenceRunner([
      runningApps([["com.apple.finder", "/System/Library/CoreServices/Finder.app"]]),
      windows(5),
    ]);

    const result = await open(
      "com.apple.finder",
      runnersWith({ aerospace, osascript: recordingRunner() }),
      1,
    );

    expect(result.isError).toBe(true);
    expect(text(result)).toBe(
      "asked com.apple.finder for a new window but no window appeared within 1ms",
    );
  });
});

describe("open_app errors", () => {
  it("names the AeroSpace command that failed", async () => {
    const aerospace = sequenceRunner([failed("boom\n")]);

    const result = await open("com.apple.calculator", runnersWith({ aerospace }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe("aerospace list-apps exited with code 1: boom");
  });

  it("reports a failed window listing", async () => {
    const aerospace = sequenceRunner([runningApps([]), failed("no monitor\n")]);

    const result = await open("com.apple.calculator", runnersWith({ aerospace }));

    expect(text(result)).toBe(
      "open_app failed: aerospace list-windows exited with code 1: no monitor",
    );
  });
});
