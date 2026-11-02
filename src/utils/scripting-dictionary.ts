import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Opener } from "../config.js";
import { DICTIONARY_KINDS, NEW_WINDOW_COMMANDS, type WindowKind } from "../consts/open-commands.js";
import type { Runners } from "../runners.js";

function applicationBlocks(xml: string): string[] {
  return [
    ...xml.matchAll(
      /<class(?:-extension)?\b[^>]*\b(?:name|extends)="application"[^>]*>([\s\S]*?)<\/class(?:-extension)?>/g,
    ),
  ].map(([, body]) => body);
}

export function creatableElements(xmls: string[]): Set<string> {
  const types = new Set<string>();
  for (const xml of xmls) {
    for (const body of applicationBlocks(xml)) {
      for (const [, attrs] of body.matchAll(/<element\b([^>]*)>/g)) {
        const type = attrs.match(/\btype="([^"]*)"/)?.[1];
        const access = attrs.match(/\baccess="([^"]*)"/)?.[1] ?? "rw";
        if (type && access.includes("w")) {
          types.add(type);
        }
      }
    }
  }
  return types;
}

function toFilePath(href: string): string | undefined {
  try {
    return fileURLToPath(new URL(href));
  } catch {
    return undefined;
  }
}

export function pickKind(types: Set<string>): WindowKind | undefined {
  return DICTIONARY_KINDS.find((kind) => types.has(kind));
}

export const dictionaryLookup = async (
  runners: Runners,
  path: string,
  includeDir = "/System/Library/ScriptingDefinitions",
): Promise<Opener | undefined> => {
  const commandDictionaryRes = await runners.plutil.run([
    "-extract",
    "OSAScriptingDefinition",
    "raw",
    `${path}/Contents/Info.plist`,
  ]);

  if (commandDictionaryRes.code !== 0) {
    return undefined;
  }

  const dictionaryName = commandDictionaryRes.stdout.trim();
  if (!dictionaryName || dictionaryName.includes("/") || dictionaryName.includes("..")) {
    return undefined;
  }

  let fileXml: string;
  try {
    fileXml = await readFile(join(path, "Contents", "Resources", dictionaryName), "utf8");
  } catch {
    return undefined;
  }

  // Paths inside the XML file to include other files, limited to includeDir
  const references = [...fileXml.matchAll(/<xi:include\b[^>]*\bhref="([^"]*)"/g)]
    .map(([, href]) => toFilePath(href))
    .filter((file): file is string => file !== undefined && dirname(file) === includeDir);

  // Unreadable includes are skipped
  const reads = await Promise.allSettled(references.map((file) => readFile(file, "utf8")));
  const referenceXmls = reads.flatMap((read) => (read.status === "fulfilled" ? [read.value] : []));

  const kind = pickKind(creatableElements([fileXml, ...referenceXmls]));

  if (!kind) {
    return undefined;
  }

  return { type: "applescript", command: NEW_WINDOW_COMMANDS[kind] };
};
