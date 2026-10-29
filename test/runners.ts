import type { Runner, RunResult } from "../src/process.js";
import type { Runners } from "../src/runners.js";

export function recordingRunner(
  result: RunResult = { code: 0, stdout: "", stderr: "" },
): Runner & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async run(args) {
      calls.push(args);
      return result;
    },
  };
}

export function throwingRunner(message: string): Runner {
  return {
    async run() {
      throw new Error(message);
    },
  };
}

export function runnersWith(runners: Partial<Runners>): Runners {
  return {
    aerospace: throwingRunner("unexpected aerospace call"),
    mdfind: throwingRunner("unexpected mdfind call"),
    mdls: throwingRunner("unexpected mdls call"),
    ...runners,
  };
}
