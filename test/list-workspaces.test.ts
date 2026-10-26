import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { AerospaceResult, AerospaceRunner } from "../src/aerospace.js";
import { createServer } from "../src/server.js";

function runner(
  impl: (args: string[]) => AerospaceResult | Promise<AerospaceResult>,
): AerospaceRunner & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(args) {
      calls.push(args);
      return impl(args);
    },
  };
}

async function connect(aerospace: AerospaceRunner): Promise<Client> {
  const server = createServer(aerospace);
  const client = new Client({ name: "test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

const WORKSPACE_FORMAT = [
  "--format",
  "%{workspace} %{workspace-is-focused} %{workspace-is-visible} %{monitor-id} %{monitor-name} %{workspace-root-container-layout}",
];

describe("list_workspaces", () => {
  it("returns parsed workspaces", async () => {
    const aerospace = runner(() => ({
      code: 0,
      stdout: JSON.stringify([{ workspace: "1" }, { workspace: "S" }]),
      stderr: "",
    }));
    const client = await connect(aerospace);

    const result = await client.callTool({ name: "list_workspaces", arguments: {} });

    expect(aerospace.calls).toEqual([
      ["list-workspaces", "--monitor", "focused", ...WORKSPACE_FORMAT, "--json"],
    ]);
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify([{ workspace: "1" }, { workspace: "S" }]) },
    ]);

    await client.callTool({ name: "list_workspaces", arguments: { scope: "focused" } });
    expect(aerospace.calls[1]).toEqual([
      "list-workspaces",
      "--focused",
      ...WORKSPACE_FORMAT,
      "--json",
    ]);

    await client.callTool({
      name: "list_workspaces",
      arguments: { monitor: 1, visible: false, empty: false },
    });
    expect(aerospace.calls[2]).toEqual([
      "list-workspaces",
      "--monitor",
      "1",
      "--visible",
      "no",
      "--empty",
      "no",
      ...WORKSPACE_FORMAT,
      "--json",
    ]);
  });

  it("returns a tool error when aerospace exits non-zero", async () => {
    const aerospace = runner(() => ({ code: 1, stdout: "", stderr: "boom" }));
    const client = await connect(aerospace);

    const result = await client.callTool({
      name: "list_workspaces",
      arguments: { scope: "all" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "aerospace exited with code 1: boom" }]);
  });
});
