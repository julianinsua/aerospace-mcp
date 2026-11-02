import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  creatableElements,
  dictionaryLookup,
  pickKind,
} from "../src/utils/scripting-dictionary.js";
import { recordingRunner, runnersWith } from "./runners.js";

const sdef = (body: string) => `<?xml version="1.0"?><dictionary>${body}</dictionary>`;
const applicationClass = (elements: string) =>
  `<suite name="Suite"><class name="application" code="capp">${elements}</class></suite>`;
const plutilPrints = (stdout: string, code = 0) => recordingRunner({ code, stdout, stderr: "" });

describe("creatableElements", () => {
  it("collects writable elements of the application class", () => {
    const xml = sdef(
      applicationClass(
        '<element type="document"/><element type="window" access="r"/><element type="tab" access="rw"/>',
      ),
    );

    expect(creatableElements([xml])).toEqual(new Set(["document", "tab"]));
  });

  it("reads class extensions of application", () => {
    const xml = sdef(
      '<class-extension extends="application"><element type="window"/></class-extension>',
    );

    expect(creatableElements([xml])).toEqual(new Set(["window"]));
  });

  it("ignores elements of other classes", () => {
    const xml = sdef('<class name="document"><element type="window"/></class>');

    expect(creatableElements([xml])).toEqual(new Set());
  });

  it("merges the elements of every file", () => {
    const app = sdef(applicationClass('<element type="tab"/>'));
    const included = sdef(applicationClass('<element type="window"/>'));

    expect(creatableElements([app, included])).toEqual(new Set(["tab", "window"]));
  });
});

describe("pickKind", () => {
  it("prefers document over window", () => {
    expect(pickKind(new Set(["window", "document"]))).toBe("document");
  });

  it("returns undefined without a supported kind", () => {
    expect(pickKind(new Set(["tab", "Finder window"]))).toBeUndefined();
  });
});

describe("dictionaryLookup", () => {
  let root: string;
  let appPath: string;
  let includeDir: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "aerospace-mcp-sdef-"));
    appPath = join(root, "Writer.app");
    includeDir = join(root, "ScriptingDefinitions");
    const outsideDir = join(root, "Elsewhere");
    await mkdir(join(appPath, "Contents", "Resources"), { recursive: true });
    await mkdir(includeDir);
    await mkdir(outsideDir);

    await writeFile(
      join(includeDir, "Standard.sdef"),
      sdef(applicationClass('<element type="document"/>')),
    );
    await writeFile(
      join(outsideDir, "Other.sdef"),
      sdef(applicationClass('<element type="window"/>')),
    );
    const include = (file: string) =>
      `<xi:include href="${pathToFileURL(file).href}" xpointer="xpointer(/dictionary/suite)"/>`;

    await writeFile(
      join(appPath, "Contents", "Resources", "Writer.sdef"),
      sdef(include(join(includeDir, "Standard.sdef"))),
    );
    await writeFile(
      join(appPath, "Contents", "Resources", "Outside.sdef"),
      sdef(include(join(outsideDir, "Other.sdef"))),
    );
    await writeFile(
      join(appPath, "Contents", "Resources", "Missing.sdef"),
      sdef(
        include(join(includeDir, "Missing.sdef")) + applicationClass('<element type="window"/>'),
      ),
    );
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("asks plutil for the dictionary name in Info.plist", async () => {
    const plutil = plutilPrints("Writer.sdef\n");

    await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir);

    expect(plutil.calls).toEqual([
      ["-extract", "OSAScriptingDefinition", "raw", `${appPath}/Contents/Info.plist`],
    ]);
  });

  it("finds the opener in an included file", async () => {
    const plutil = plutilPrints("Writer.sdef\n");

    expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toEqual({
      type: "applescript",
      command: "make new document",
    });
  });

  it("skips includes outside the include folder", async () => {
    const plutil = plutilPrints("Outside.sdef\n");

    expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toBeUndefined();
  });

  it("skips includes that cannot be read", async () => {
    const plutil = plutilPrints("Missing.sdef\n");

    expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toEqual({
      type: "applescript",
      command: "make new window",
    });
  });

  it("returns undefined when the app has no dictionary", async () => {
    const plutil = plutilPrints("", 1);

    expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toBeUndefined();
  });

  it("returns undefined when the dictionary file is missing", async () => {
    const plutil = plutilPrints("Gone.sdef\n");

    expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toBeUndefined();
  });

  it.each(["../Writer.app/Contents/Resources/Writer.sdef", "..", "  "])(
    "rejects the dictionary name %j",
    async (name) => {
      const plutil = plutilPrints(`${name}\n`);

      expect(await dictionaryLookup(runnersWith({ plutil }), appPath, includeDir)).toBeUndefined();
    },
  );
});
