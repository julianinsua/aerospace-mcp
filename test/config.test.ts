import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultConfigPath, expandHome, loadConfig } from "../src/config.js";

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

describe("expandHome", () => {
  it("expands a leading ~/", () => {
    expect(expandHome("~/aerospace-mcp.json")).toBe(join(homedir(), "aerospace-mcp.json"));
  });

  it("expands a lone ~", () => {
    expect(expandHome("~")).toBe(homedir());
  });

  it("leaves other paths alone", () => {
    expect(expandHome("/abs/config.json")).toBe("/abs/config.json");
    expect(expandHome("~other/config.json")).toBe("~other/config.json");
    expect(expandHome("dir/~/config.json")).toBe("dir/~/config.json");
  });
});

describe("loadConfig", () => {
  let dir: string;

  const write = async (name: string, contents: string) => {
    const file = join(dir, name);
    await writeFile(file, contents);
    return file;
  };

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "aerospace-mcp-config-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns an empty config when the default file does not exist", async () => {
    await expect(loadConfig(undefined, { XDG_CONFIG_HOME: join(dir, "none") })).resolves.toEqual({
      openers: {},
    });
  });

  it("reads the default file from XDG_CONFIG_HOME", async () => {
    await mkdir(join(dir, "xdg", "aerospace-mcp"), { recursive: true });
    await write(
      "xdg/aerospace-mcp/config.json",
      JSON.stringify({ openers: { "com.example": { type: "newInstance", args: [] } } }),
    );
    await expect(loadConfig(undefined, { XDG_CONFIG_HOME: join(dir, "xdg") })).resolves.toEqual({
      openers: { "com.example": { type: "newInstance", args: [] } },
    });
  });

  it("fails when an explicit file does not exist", async () => {
    const file = join(dir, "missing.json");
    await expect(loadConfig(file)).rejects.toThrow(`cannot read config ${file}:`);
  });

  it("fails on invalid JSON", async () => {
    const file = await write("broken.json", "{ openers: }");
    await expect(loadConfig(file)).rejects.toThrow(`config file ${file} is not valid JSON:`);
  });

  it("fails on an unknown opener type", async () => {
    const file = await write(
      "unknown-type.json",
      JSON.stringify({ openers: { "com.example": { type: "shell", command: "true" } } }),
    );
    await expect(loadConfig(file)).rejects.toThrow(
      `invalid config ${file}:\n✖ Invalid discriminator value`,
    );
    await expect(loadConfig(file)).rejects.toThrow('at openers["com.example"].type');
  });

  it("fails on unknown keys", async () => {
    const file = await write("unknown-key.json", JSON.stringify({ openers: {}, extra: true }));
    await expect(loadConfig(file)).rejects.toThrow(`invalid config ${file}:`);
  });

  it("defaults openers to an empty record", async () => {
    const file = await write("empty.json", "{}");
    await expect(loadConfig(file)).resolves.toEqual({ openers: {} });
  });

  it("parses every opener type", async () => {
    const openers = {
      "com.example.script": { type: "applescript", command: "make new window" },
      "com.example.exec": { type: "exec", bin: "{bundlePath}/Contents/MacOS/app", args: ["{pid}"] },
      "com.example.instance": { type: "newInstance", args: ["--flag"] },
    };
    const file = await write("valid.json", JSON.stringify({ openers }));
    await expect(loadConfig(file)).resolves.toEqual({ openers });
  });
});
