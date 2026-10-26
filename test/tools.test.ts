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

describe("tool argv", () => {
  it.each([
    ["list_workspaces", {}, ["list-workspaces", "--monitor", "all", ...WORKSPACE_FORMAT, "--json"]],
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
      { monitor: "focused", workspace: 2, appBundleId: "com.apple.Safari" },
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
      { target: 3, focusFollowsWindow: true, failIfNoop: true, windowId: 5, wrapAround: true },
      [
        "move-node-to-workspace",
        "--focus-follows-window",
        "--fail-if-noop",
        "--window-id",
        "5",
        "3",
      ],
    ],
  ])("%s %j", (name, input, expected) => {
    expect(argsFor(name, input)).toEqual(expected);
  });
});

describe("registered tools", () => {
  it("runs mutating tools without --json and reports success", async () => {
    const calls: string[][] = [];
    const runner: AerospaceRunner = {
      async run(args) {
        calls.push(args);
        return { code: 0, stdout: "", stderr: "" };
      },
    };
    const server = createServer(runner);
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

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
      list_workspaces: true,
      list_windows: true,
      move_window: false,
      move_window_to_workspace: false,
    });
  });
});
