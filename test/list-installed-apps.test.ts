import { describe, expect, it } from "vitest";
import { listInstalledAppsTool, parseInstalledApps } from "../src/tools/list-installed-apps.js";
import { recordingRunner, runnersWith, throwingRunner } from "./runners.js";

const MDFIND_ARGS = [
  "-onlyin",
  "/Applications",
  "-onlyin",
  "/System/Applications",
  "kMDItemContentType == 'com.apple.application-bundle'",
];
const PATHS = ["/Applications/Safari.app", "/Applications/Google Chrome.app"];
const MDLS_OUTPUT = ["com.apple.Safari", "Safari", "com.google.Chrome", "Google Chrome"].join("\0");
const SORTED_APPS = [
  {
    "app-bundle-id": "com.google.Chrome",
    "app-name": "Google Chrome",
    "app-path": "/Applications/Google Chrome.app",
  },
  {
    "app-bundle-id": "com.apple.Safari",
    "app-name": "Safari",
    "app-path": "/Applications/Safari.app",
  },
];

function text(result: Awaited<ReturnType<typeof listInstalledAppsTool.handle>>): string {
  const [item] = result.content;
  return item?.type === "text" ? item.text : "";
}

describe("parseInstalledApps", () => {
  it("pairs each path with its bundle id and name, sorted by name", () => {
    expect(parseInstalledApps(PATHS, MDLS_OUTPUT.split("\0"))).toEqual(SORTED_APPS);
  });

  it("skips apps without a bundle id", () => {
    const metadata = ["(null)", "Safari", "com.google.Chrome", "Google Chrome"];

    expect(parseInstalledApps(PATHS, metadata)).toEqual([SORTED_APPS[0]]);
  });

  it("rejects metadata that does not have two values per path", () => {
    expect(() => parseInstalledApps(PATHS, ["com.apple.Safari", "Safari"])).toThrow(
      "mdls returned 2 values for 2 apps, expected 4",
    );
  });
});

describe("list_installed_apps", () => {
  it("runs mdfind, then mdls on every path, and returns the sorted apps", async () => {
    const mdfind = recordingRunner({ code: 0, stdout: `${PATHS.join("\n")}\n`, stderr: "" });
    const mdls = recordingRunner({ code: 0, stdout: MDLS_OUTPUT, stderr: "" });

    const result = await listInstalledAppsTool.handle({}, runnersWith({ mdfind, mdls }));

    expect(mdfind.calls).toEqual([MDFIND_ARGS]);
    expect(mdls.calls).toEqual([
      ["-raw", "-name", "kMDItemCFBundleIdentifier", "-name", "kMDItemDisplayName", ...PATHS],
    ]);
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(text(result))).toEqual(SORTED_APPS);
  });

  it("reports Spotlight indexing when mdfind finds nothing", async () => {
    const mdfind = recordingRunner({ code: 0, stdout: "", stderr: "" });

    const result = await listInstalledAppsTool.handle({}, runnersWith({ mdfind }));

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Spotlight indexing is probably off");
  });

  it("names the command that exited non-zero", async () => {
    const mdfind = recordingRunner({ code: 0, stdout: `${PATHS.join("\n")}\n`, stderr: "" });
    const mdls = recordingRunner({ code: 1, stdout: "", stderr: "boom\n" });

    const result = await listInstalledAppsTool.handle({}, runnersWith({ mdfind, mdls }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe("mdls exited with code 1: boom");
  });

  it("turns a thrown runner error into a tool error", async () => {
    const mdfind = throwingRunner("process timed out after 5000ms");

    const result = await listInstalledAppsTool.handle({}, runnersWith({ mdfind }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe("list_installed_apps failed: process timed out after 5000ms");
  });

  it("turns mismatched metadata into a tool error", async () => {
    const mdfind = recordingRunner({ code: 0, stdout: `${PATHS.join("\n")}\n`, stderr: "" });
    const mdls = recordingRunner({ code: 0, stdout: "com.apple.Safari\0Safari", stderr: "" });

    const result = await listInstalledAppsTool.handle({}, runnersWith({ mdfind, mdls }));

    expect(result.isError).toBe(true);
    expect(text(result)).toBe(
      "list_installed_apps failed: mdls returned 2 values for 2 apps, expected 4",
    );
  });
});
