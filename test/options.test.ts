import { describe, expect, it } from "vitest";
import { serverOptions } from "../src/options.js";

describe("serverOptions", () => {
  it("keeps mutations off by default", () => {
    expect(serverOptions([], {})).toEqual({ allowMutations: false });
  });

  it("enables mutations with --allow-mutations", () => {
    expect(serverOptions(["--allow-mutations"], {})).toEqual({ allowMutations: true });
  });

  it("enables mutations with AEROSPACE_ALLOW_MUTATIONS=1", () => {
    expect(serverOptions([], { AEROSPACE_ALLOW_MUTATIONS: "1" })).toEqual({ allowMutations: true });
  });

  it("ignores other AEROSPACE_ALLOW_MUTATIONS values", () => {
    expect(serverOptions([], { AEROSPACE_ALLOW_MUTATIONS: "true" })).toEqual({
      allowMutations: false,
    });
  });

  it("reads the config path from --config", () => {
    expect(serverOptions(["--config", "/etc/aerospace-mcp.json"], {}).configPath).toBe(
      "/etc/aerospace-mcp.json",
    );
  });

  it("reads the config path from AEROSPACE_MCP_CONFIG", () => {
    expect(serverOptions([], { AEROSPACE_MCP_CONFIG: "/etc/aerospace-mcp.json" }).configPath).toBe(
      "/etc/aerospace-mcp.json",
    );
  });

  it("prefers --config over AEROSPACE_MCP_CONFIG", () => {
    expect(
      serverOptions(["--config", "/flag.json"], { AEROSPACE_MCP_CONFIG: "/env.json" }).configPath,
    ).toBe("/flag.json");
  });

  it("rejects unknown flags", () => {
    expect(() => serverOptions(["--allow-mutation"], {})).toThrow(
      "Unknown option '--allow-mutation'",
    );
  });
});
