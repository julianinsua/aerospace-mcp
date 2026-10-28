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

  it("rejects unknown flags", () => {
    expect(() => serverOptions(["--allow-mutation"], {})).toThrow(
      "Unknown option '--allow-mutation'",
    );
  });
});
