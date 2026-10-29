import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { createRunner, type Runner } from "./process.js";

// GUI apps often start servers with a PATH that lacks the Homebrew prefixes.
const FALLBACK_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function aerospaceBin(env: NodeJS.ProcessEnv = process.env, exists = isExecutable): string {
  if (env.AEROSPACE_BIN) {
    return env.AEROSPACE_BIN;
  }
  const dirs = [...(env.PATH ?? "").split(delimiter).filter(Boolean), ...FALLBACK_DIRS];
  return dirs.map((dir) => join(dir, "aerospace")).find(exists) ?? "aerospace";
}

export function createAerospaceRunner(): Runner {
  return createRunner(aerospaceBin());
}
