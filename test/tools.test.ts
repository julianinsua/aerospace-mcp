import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { AerospaceRunner } from "../src/aerospace.js";
import { createServer } from "../src/server.js";
import { tools } from "../src/tools/index.js";
import { toCommandArgs } from "../src/tools/tool.js";

function argsFor(name: string, input: Record<string, unknown>): string[] {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`no tool named ${name}`);
  }
  return toCommandArgs(tool, tool.inputSchema.parse(input));
}

const WORKSPACE_FORMAT = [
  "--format",
  "%{workspace} %{workspace-is-focused} %{workspace-is-visible} %{monitor-id} %{monitor-name} %{workspace-root-container-layout}",
];
const WINDOW_FORMAT = [
  "--format",
  "%{window-id} %{app-name} %{app-bundle-id} %{app-pid} %{window-title} %{window-is-fullscreen} %{workspace} %{monitor-id}",
];
const MONITOR_FORMAT = ["--format", "%{monitor-id} %{monitor-name} %{monitor-is-main}"];

describe("tool argv", () => {
  it.each([
    [
      "list_workspaces",
      {},
      ["list-workspaces", "--monitor", "focused", ...WORKSPACE_FORMAT, "--json"],
    ],
    ["list_windows", {}, ["list-windows", "--monitor", "focused", ...WINDOW_FORMAT, "--json"]],
    [
      "list_workspaces",
      { scope: "all" },
      ["list-workspaces", "--all", ...WORKSPACE_FORMAT, "--json"],
    ],
    [
      "list_workspaces",
      { monitor: "focused", visible: true, empty: false },
      [
        "list-workspaces",
        "--monitor",
        "focused",
        "--visible",
        "--empty",
        "no",
        ...WORKSPACE_FORMAT,
        "--json",
      ],
    ],
    [
      "list_windows",
      { scope: "focused" },
      ["list-windows", "--focused", ...WINDOW_FORMAT, "--json"],
    ],
    [
      "list_windows",
      { monitor: "focused", workspace: "2", appBundleId: "com.apple.Safari" },
      [
        "list-windows",
        "--monitor",
        "focused",
        "--workspace",
        "2",
        "--app-bundle-id",
        "com.apple.Safari",
        ...WINDOW_FORMAT,
        "--json",
      ],
    ],
    ["move_window", { direction: "left" }, ["move", "left"]],
    [
      "move_window",
      { direction: "down", failIfFullscreen: true, failIfMacosNativeFullscreen: true },
      ["move", "--fail-if-fullscreen", "--fail-if-macos-native-fullscreen", "down"],
    ],
    [
      "move_window",
      { direction: "up", windowId: 0, boundaries: "workspace", boundariesAction: "stop" },
      [
        "move",
        "--window-id",
        "0",
        "--boundaries",
        "workspace",
        "--boundaries-action",
        "stop",
        "up",
      ],
    ],
    [
      "move_window_to_workspace",
      { target: "next", wrapAround: true, failIfNoop: true, windowId: 5 },
      ["move-node-to-workspace", "--wrap-around", "next"],
    ],
    [
      "move_window_to_workspace",
      { target: "3", focusFollowsWindow: true, failIfNoop: true, windowId: 5, wrapAround: true },
      [
        "move-node-to-workspace",
        "--focus-follows-window",
        "--fail-if-noop",
        "--window-id",
        "5",
        "--",
        "3",
      ],
    ],
    ["move_window_to_workspace", { target: "S" }, ["move-node-to-workspace", "--", "S"]],
    [
      "list_windows",
      { workspace: "S" },
      ["list-windows", "--workspace", "S", ...WINDOW_FORMAT, "--json"],
    ],
    ["close_window", {}, ["close"]],
    [
      "close_window",
      { quitIfLastWindow: true, windowId: 7 },
      ["close", "--quit-if-last-window", "--window-id", "7"],
    ],
    ["focus_window", { target: "left" }, ["focus", "left"]],
    [
      "focus_window",
      {
        target: "right",
        boundaries: "all-monitors-outer-frame",
        boundariesAction: "wrap-around-all-monitors",
        failIfFullscreen: true,
      },
      [
        "focus",
        "--boundaries",
        "all-monitors-outer-frame",
        "--boundaries-action",
        "wrap-around-all-monitors",
        "--fail-if-fullscreen",
        "right",
      ],
    ],
    [
      "focus_window",
      { target: "dfs-next", ignoreFloating: true, boundariesAction: "wrap-around-the-workspace" },
      [
        "focus",
        "--ignore-floating",
        "--boundaries-action",
        "wrap-around-the-workspace",
        "dfs-next",
      ],
    ],
    ["focus_window", { windowId: 0 }, ["focus", "--window-id", "0"]],
    ["focus_window", { dfsIndex: 0 }, ["focus", "--dfs-index", "0"]],
    ["list_monitors", {}, ["list-monitors", ...MONITOR_FORMAT, "--json"]],
    [
      "list_monitors",
      { focused: true },
      ["list-monitors", "--focused", ...MONITOR_FORMAT, "--json"],
    ],
    [
      "list_monitors",
      { mouse: false },
      ["list-monitors", "--mouse", "no", ...MONITOR_FORMAT, "--json"],
    ],
  ])("%s %j", (name, input, expected) => {
    expect(argsFor(name, input)).toEqual(expected);
  });

  it.each([
    [{}],
    [{ target: "left", windowId: 3 }],
    [{ windowId: 3, dfsIndex: 1 }],
    [{ windowId: 3, ignoreFloating: true }],
    [{ target: "dfs-next", boundaries: "all-monitors-outer-frame" }],
    [{ target: "dfs-prev", boundariesAction: "wrap-around-all-monitors" }],
    [{ target: "dfs-next", failIfFullscreen: true }],
    [{ dfsIndex: -1 }],
  ])("focus_window rejects %j", (input) => {
    expect(() => argsFor("focus_window", input)).toThrow();
  });
});

function recordingRunner(): AerospaceRunner & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(args) {
      calls.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
  };
}

async function connect(
  runner: AerospaceRunner,
  options?: Parameters<typeof createServer>[1],
): Promise<Client> {
  const server = createServer(runner, options);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe("registered tools", () => {
  it("runs mutating tools without --json and reports success", async () => {
    const runner = recordingRunner();
    const { calls } = runner;
    const client = await connect(runner, { allowMutations: true });

    const result = await client.callTool({
      name: "move_window",
      arguments: { direction: "right" },
    });

    expect(calls).toEqual([["move", "right"]]);
    expect(result.content).toEqual([{ type: "text", text: "success" }]);

    const { tools: listed } = await client.listTools();
    expect(
      Object.fromEntries(listed.map((tool) => [tool.name, tool.annotations?.readOnlyHint])),
    ).toEqual({
      close_window: false,
      focus_window: false,
      list_monitors: true,
      list_workspaces: true,
      list_windows: true,
      move_window: false,
      move_window_to_workspace: false,
    });
  });

  it("hides mutating tools unless AEROSPACE_ALLOW_MUTATIONS is 1", async () => {
    const previous = process.env.AEROSPACE_ALLOW_MUTATIONS;
    delete process.env.AEROSPACE_ALLOW_MUTATIONS;
    try {
      const client = await connect(recordingRunner());
      const { tools: listed } = await client.listTools();
      expect(listed.map((tool) => tool.name).sort()).toEqual([
        "list_monitors",
        "list_windows",
        "list_workspaces",
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.AEROSPACE_ALLOW_MUTATIONS;
      } else {
        process.env.AEROSPACE_ALLOW_MUTATIONS = previous;
      }
    }
  });

  it("requires confirm: true before running close_window", async () => {
    const runner = recordingRunner();
    const client = await connect(runner, { allowMutations: true });

    const { tools: listed } = await client.listTools();
    const close = listed.find((tool) => tool.name === "close_window");
    expect(close?.annotations?.destructiveHint).toBe(true);
    expect(close?.inputSchema.required).toContain("confirm");

    for (const args of [{ windowId: 7 }, { windowId: 7, confirm: false }]) {
      const rejected = await client.callTool({ name: "close_window", arguments: args });
      expect(rejected.isError).toBe(true);
    }
    expect(runner.calls).toEqual([]);

    const result = await client.callTool({
      name: "close_window",
      arguments: { windowId: 7, confirm: true },
    });
    expect(result.isError).not.toBe(true);
    expect(runner.calls).toEqual([["close", "--window-id", "7"]]);
  });
});
