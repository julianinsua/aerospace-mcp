import {
  type ChildProcess,
  type SpawnOptionsWithStdioTuple,
  type StdioNull,
  type StdioPipe,
  spawn,
} from "node:child_process";
import { once } from "node:events";
import type { Readable } from "node:stream";

const DEFAULT_TIMEOUT_MS = 5_000;

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface Runner {
  run(args: string[]): Promise<RunResult>;
}

export class RunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunError";
  }
}

const spawnChild = (
  bin: string,
  args: string[],
  options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe> = {
    // stdin is /dev/null: AeroSpace hangs on an open pipe, and nothing we run reads input.
    stdio: ["ignore", "pipe", "pipe"],
  },
) => {
  const child = spawn(bin, args, options);
  const stdoutStream = child.stdout;
  const stderrStream = child.stderr;
  if (!stdoutStream || !stderrStream) {
    throw new RunError(`${bin} stdio pipes were not created`);
  }
  return { stdoutStream, stderrStream, child };
};

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function stopChild(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
}

async function exitCode(child: ChildProcess, timeoutMs: number): Promise<number> {
  try {
    const [code] = await once(child, "close", { signal: AbortSignal.timeout(timeoutMs) });
    return typeof code === "number" ? code : 1;
  } catch (error) {
    stopChild(child);
    if (isTimeoutError(error)) {
      throw new RunError(`process timed out after ${timeoutMs}ms`);
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

function toRunError(bin: string, error: unknown): RunError {
  if (error instanceof RunError) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
    return new RunError(`binary not found at ${bin}.`);
  }
  if (error instanceof Error) {
    return new RunError(error.message);
  }
  return new RunError("Unknown error");
}

async function waitForExit(
  stdoutStream: Readable,
  stderrStream: Readable,
  child: ChildProcess,
  timeoutMs: number,
): Promise<RunResult> {
  const stdoutPromise = readOutput(stdoutStream);
  const stderrPromise = readOutput(stderrStream);
  try {
    const code = await exitCode(child, timeoutMs);
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
    return { stdout, stderr, code };
  } catch (error) {
    stdoutStream.destroy();
    stderrStream.destroy();
    await Promise.allSettled([stdoutPromise, stderrPromise]);
    throw error;
  }
}

export function createRunner(bin: string, timeoutMs = DEFAULT_TIMEOUT_MS): Runner {
  return {
    async run(args): Promise<RunResult> {
      try {
        const { stdoutStream, stderrStream, child } = spawnChild(bin, args);
        return await waitForExit(stdoutStream, stderrStream, child, timeoutMs);
      } catch (error) {
        throw toRunError(bin, error);
      }
    },
  };
}
