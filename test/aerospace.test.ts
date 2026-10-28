import { afterEach, describe, expect, it } from "vitest";
import { aerospaceBin, createAerospaceRunner } from "../src/aerospace.js";

describe("aerospaceBin", () => {
  const existing =
    (...files: string[]) =>
    (file: string) =>
      files.includes(file);

  it("prefers AEROSPACE_BIN", () => {
    const env = { AEROSPACE_BIN: "/custom/aerospace", PATH: "/usr/bin" };

    expect(aerospaceBin(env, existing("/usr/bin/aerospace"))).toBe("/custom/aerospace");
  });

  it("searches PATH before the Homebrew prefixes", () => {
    const env = { PATH: "/usr/bin:/custom/bin" };

    expect(
      aerospaceBin(env, existing("/custom/bin/aerospace", "/opt/homebrew/bin/aerospace")),
    ).toBe("/custom/bin/aerospace");
  });

  it("falls back to Homebrew when PATH lacks aerospace", () => {
    const env = { PATH: "/usr/bin:/bin" };

    expect(aerospaceBin(env, existing("/opt/homebrew/bin/aerospace"))).toBe(
      "/opt/homebrew/bin/aerospace",
    );
    expect(aerospaceBin(env, existing("/usr/local/bin/aerospace"))).toBe(
      "/usr/local/bin/aerospace",
    );
  });

  it("returns the bare name when nothing is found", () => {
    expect(aerospaceBin({}, existing())).toBe("aerospace");
  });
});

describe("createAerospaceRunner", () => {
  const previous = process.env.AEROSPACE_BIN;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.AEROSPACE_BIN;
    } else {
      process.env.AEROSPACE_BIN = previous;
    }
  });

  it("returns when the command does not read stdin", async () => {
    process.env.AEROSPACE_BIN = "/bin/cat";

    const result = await createAerospaceRunner().run([]);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  }, 8_000);

  it("reports a missing binary", async () => {
    process.env.AEROSPACE_BIN = "/no/such/aerospace";

    await expect(
      createAerospaceRunner().run(["list-workspaces", "--all", "--json"]),
    ).rejects.toThrow("binary not found at /no/such/aerospace.");
  });
});
