import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { Runner } from "../src/process.js";
import { createServer } from "../src/server.js";
import { tools } from "../src/tools/index.js";
import { recordingRunner, runnersWith } from "./runners.js";

async function argsFor(name: string, input: Record<string, unknown>): Promise<string[]> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`no tool named ${name}`);
  }
  const runner = recordingRunner();
  await tool.handle(tool.inputSchema.parse(input), runnersWith({ aerospace: runner }));
  return runner.calls[0] ?? [];
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
const APP_FORMAT = ["--format", "%{app-pid} %{app-bundle-id} %{app-name}"];

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
      { scope: "focused" },
      ["list-workspaces", "--focused", ...WORKSPACE_FORMAT, "--json"],
    ],
    [
      "list_workspaces",
      { monitor: 1, visible: false, empty: false },
      [
        "list-workspaces",
        "--monitor",
        "1",
        "--visible",
        "no",
        "--empty",
        "no",
        ...WORKSPACE_FORMAT,
        "--json",
      ],
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
    ["list_apps", {}, ["list-apps", ...APP_FORMAT, "--json"]],
    [
      "list_apps",
      { macosNativeHidden: true },
      ["list-apps", "--macos-native-hidden", ...APP_FORMAT, "--json"],
    ],
    [
      "list_apps",
      { macosNativeHidden: false },
      ["list-apps", "--macos-native-hidden", "no", ...APP_FORMAT, "--json"],
    ],
    ["list_modes", {}, ["list-modes", "--json"]],
    ["list_modes", { current: true }, ["list-modes", "--current", "--json"]],
    ["get_config", { name: "mode" }, ["config", "--get", "mode", "--json"]],
    [
      "get_config",
      { name: "mode.main.binding", keys: true },
      ["config", "--get", "mode.main.binding", "--keys", "--json"],
    ],
    ["switch_workspace", { target: "S" }, ["workspace", "--", "S"]],
    [
      "switch_workspace",
      { target: "2", autoBackAndForth: true, wrapAround: true },
      ["workspace", "--auto-back-and-forth", "--", "2"],
    ],
    [
      "switch_workspace",
      { target: "next", wrapAround: true, failIfNoop: true },
      ["workspace", "--wrap-around", "next"],
    ],
    ["workspace_back_and_forth", {}, ["workspace-back-and-forth"]],
    [
      "focus_monitor",
      { target: "left", wrapAround: true },
      ["focus-monitor", "--wrap-around", "left"],
    ],
    ["focus_monitor", { target: "prev" }, ["focus-monitor", "prev"]],
    ["focus_monitor", { target: 2, wrapAround: true }, ["focus-monitor", "--", "2"]],
    ["focus_monitor", { target: "dell" }, ["focus-monitor", "--", "dell"]],
    ["summon_workspace", { workspace: "3" }, ["summon-workspace", "--", "3"]],
    [
      "summon_workspace",
      { workspace: "S", failIfNoop: true },
      ["summon-workspace", "--fail-if-noop", "--", "S"],
    ],
    ["move_workspace_to_monitor", { target: "right" }, ["move-workspace-to-monitor", "right"]],
    [
      "move_workspace_to_monitor",
      { target: "next", workspace: "S", wrapAround: true },
      ["move-workspace-to-monitor", "--workspace", "S", "--wrap-around", "next"],
    ],
    [
      "move_workspace_to_monitor",
      { target: "main", workspace: "2" },
      ["move-workspace-to-monitor", "--workspace", "2", "--", "main"],
    ],
    ["focus_back_and_forth", {}, ["focus-back-and-forth"]],
    ["move_window_to_monitor", { target: "left" }, ["move-node-to-monitor", "left"]],
    [
      "move_window_to_monitor",
      { target: "next", windowId: 4, focusFollowsWindow: true, wrapAround: true, failIfNoop: true },
      [
        "move-node-to-monitor",
        "--window-id",
        "4",
        "--focus-follows-window",
        "--wrap-around",
        "next",
      ],
    ],
    [
      "move_window_to_monitor",
      { target: 2, windowId: 4, focusFollowsWindow: true, wrapAround: true, failIfNoop: true },
      [
        "move-node-to-monitor",
        "--window-id",
        "4",
        "--focus-follows-window",
        "--fail-if-noop",
        "--",
        "2",
      ],
    ],
    ["move_window_to_monitor", { target: "dell" }, ["move-node-to-monitor", "--", "dell"]],
  ])("%s %j", async (name, input, expected) => {
    expect(await argsFor(name, input)).toEqual(expected);
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
  ])("focus_window rejects %j", async (input) => {
    await expect(argsFor("focus_window", input)).rejects.toThrow();
  });

  it.each([
    ["switch_workspace", { target: "1", autoBackAndForth: true, failIfNoop: true }],
    ["switch_workspace", { target: "" }],
    ["focus_monitor", { target: 0 }],
    ["move_workspace_to_monitor", { target: "" }],
    ["move_window_to_monitor", { target: 0 }],
    ["get_config", {}],
    ["get_config", { name: "" }],
  ])("%s rejects %j", async (name, input) => {
    await expect(argsFor(name, input)).rejects.toThrow();
  });
});

async function connect(
  runner: Runner,
  options?: Parameters<typeof createServer>[1],
): Promise<Client> {
  const server = createServer(runnersWith({ aerospace: runner }), options);
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
      focus_back_and_forth: true,
      focus_monitor: true,
      focus_window: true,
      get_config: true,
      list_apps: true,
      list_installed_apps: true,
      list_modes: true,
      list_monitors: true,
      list_workspaces: true,
      list_windows: true,
      move_window: false,
      move_window_to_monitor: false,
      move_window_to_workspace: false,
      move_workspace_to_monitor: false,
      open_app: false,
      summon_workspace: false,
      switch_workspace: true,
      workspace_back_and_forth: true,
    });
  });

  it("returns parsed JSON from json tools", async () => {
    const workspaces = [{ workspace: "1" }, { workspace: "S" }];
    const runner = recordingRunner({ code: 0, stdout: JSON.stringify(workspaces), stderr: "" });
    const client = await connect(runner);

    const result = await client.callTool({ name: "list_workspaces", arguments: {} });

    expect(runner.calls).toEqual([
      ["list-workspaces", "--monitor", "focused", ...WORKSPACE_FORMAT, "--json"],
    ]);
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(workspaces) }]);
  });

  it("includes the aerospace arguments when the command fails", async () => {
    const client = await connect(recordingRunner({ code: 1, stdout: "", stderr: "boom\n" }));

    const result = await client.callTool({
      name: "list_workspaces",
      arguments: { scope: "all" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: `aerospace list-workspaces --all ${WORKSPACE_FORMAT.join(" ")} --json exited with code 1: boom`,
      },
    ]);
  });

  it("includes the aerospace arguments when the output is not JSON", async () => {
    const client = await connect(recordingRunner({ code: 0, stdout: "not json", stderr: "" }));

    const result = await client.callTool({ name: "list_monitors", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: expect.stringMatching(
          /^aerospace list-monitors --format .* --json returned invalid JSON: /,
        ),
      },
    ]);
  });

  it("hides mutating tools unless AEROSPACE_ALLOW_MUTATIONS is 1", async () => {
    const previous = process.env.AEROSPACE_ALLOW_MUTATIONS;
    delete process.env.AEROSPACE_ALLOW_MUTATIONS;
    try {
      const client = await connect(recordingRunner());
      const { tools: listed } = await client.listTools();
      expect(listed.map((tool) => tool.name).sort()).toEqual([
        "focus_back_and_forth",
        "focus_monitor",
        "focus_window",
        "get_config",
        "list_apps",
        "list_installed_apps",
        "list_modes",
        "list_monitors",
        "list_windows",
        "list_workspaces",
        "switch_workspace",
        "workspace_back_and_forth",
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.AEROSPACE_ALLOW_MUTATIONS;
      } else {
        process.env.AEROSPACE_ALLOW_MUTATIONS = previous;
      }
    }
  });

  it("rejects unknown arguments instead of ignoring them", async () => {
    const runner = recordingRunner();
    const client = await connect(runner, { allowMutations: true });

    const { tools: listed } = await client.listTools();
    for (const tool of listed) {
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }

    for (const [name, args] of [
      ["list_windows", { focused: true }],
      ["focus_window", { windowId: 3, focused: true }],
      ["close_window", { windowId: 7, confirm: true, force: true }],
    ] as const) {
      const rejected = await client.callTool({ name, arguments: args });
      expect(rejected.isError).toBe(true);
    }
    expect(runner.calls).toEqual([]);
  });

  it("requires confirm: true before running close_window", async () => {
    const runner = recordingRunner();
    const client = await connect(runner, { allowMutations: true });

    const { tools: listed } = await client.listTools();
    const close = listed.find((tool) => tool.name === "close_window");
    expect(close?.annotations?.destructiveHint).toBe(true);
    expect(close?.inputSchema.required).toContain("confirm");
    for (const tool of listed.filter((candidate) => candidate.name !== "close_window")) {
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.inputSchema.required ?? []).not.toContain("confirm");
    }

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
