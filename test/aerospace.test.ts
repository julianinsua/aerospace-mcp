import { afterEach, describe, expect, it } from "vitest";
import { createExecRunner } from "../src/aerospace.js";

describe("createExecRunner", () => {
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

    const result = await createExecRunner().run([]);

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  }, 8_000);

  it("reports a missing binary", async () => {
    process.env.AEROSPACE_BIN = "/no/such/aerospace";

    await expect(createExecRunner().run(["list-workspaces", "--all", "--json"])).rejects.toThrow(
      "aerospace binary not found at /no/such/aerospace. Set AEROSPACE_BIN to the aerospace executable.",
    );
  });
});
