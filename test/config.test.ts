import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfigPath } from "../src/config.js";

describe("defaultConfigPath", () => {
  it("uses ~/.config without XDG_CONFIG_HOME", () => {
    expect(defaultConfigPath({})).toBe(join(homedir(), ".config", "aerospace-mcp", "config.json"));
  });

  it("uses an absolute XDG_CONFIG_HOME", () => {
    expect(defaultConfigPath({ XDG_CONFIG_HOME: "/xdg" })).toBe("/xdg/aerospace-mcp/config.json");
  });

  it("ignores a relative XDG_CONFIG_HOME", () => {
    expect(defaultConfigPath({ XDG_CONFIG_HOME: "xdg" })).toBe(
      join(homedir(), ".config", "aerospace-mcp", "config.json"),
    );
  });
});
