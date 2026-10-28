import {
  type ChildProcess,
  type SpawnOptionsWithStdioTuple,
  type StdioNull,
  type StdioPipe,
  spawn,
} from "node:child_process";
import { once } from "node:events";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { Readable } from "node:stream";

const TIMEOUT_MS = 5_000;

export interface AerospaceResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface AerospaceRunner {
  run(args: string[]): Promise<AerospaceResult>;
}

export class AerospaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AerospaceError";
  }
}

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

const getAerospaceBinary = (
  bin: string,
  runArgs: string[],
  options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe> = {
    // AeroSpace blocks while stdin is an open pipe, so stdin stays closed.
    stdio: ["ignore", "pipe", "pipe"],
  },
) => {
  const child = spawn(bin, runArgs, options);
  const stdoutStream = child.stdout;
  const stderrStream = child.stderr;
  if (!stdoutStream || !stderrStream) {
    throw new AerospaceError("aerospace stdio pipes were not created");
  }
  return { stdoutStream, stderrStream, child };
};

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function stopChild(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
}

async function exitCode(child: ChildProcess): Promise<number> {
  try {
    const [code] = await once(child, "close", { signal: timeoutSignal() });
    return typeof code === "number" ? code : 1;
  } catch (error) {
    stopChild(child);
    if (isTimeoutError(error)) {
      throw new AerospaceError(`aerospace timed out after ${TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

async function readOutput(stream: Readable): Promise<string> {
  let output = "";
  stream.setEncoding("utf8");
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
}

function toAerospaceError(bin: string, error: unknown): AerospaceError {
  if (error instanceof AerospaceError) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
    return new AerospaceError(
      `aerospace binary not found at ${bin}. Set AEROSPACE_BIN to the aerospace executable.`,
    );
  }
  if (error instanceof Error) {
    return new AerospaceError(error.message);
  }
  return new AerospaceError("Unknown error");
}

async function waitForExit(
  stdoutStream: Readable,
  stderrStream: Readable,
  child: ChildProcess,
): Promise<AerospaceResult> {
  const stdoutPromise = readOutput(stdoutStream);
  const stderrPromise = readOutput(stderrStream);
  try {
    const code = await exitCode(child);
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
    return { stdout, stderr, code };
  } catch (error) {
    stdoutStream.destroy();
    stderrStream.destroy();
    await Promise.allSettled([stdoutPromise, stderrPromise]);
    throw error;
  }
}

export function createExecRunner(): AerospaceRunner {
  return {
    async run(args): Promise<AerospaceResult> {
      const bin = aerospaceBin();
      try {
        const { stdoutStream, stderrStream, child } = getAerospaceBinary(bin, args);
        return await waitForExit(stdoutStream, stderrStream, child);
      } catch (error) {
        throw toAerospaceError(bin, error);
      }
    },
  };
}
