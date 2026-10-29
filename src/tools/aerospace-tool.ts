import type { z } from "zod";
import { runCommand, type Tool } from "./tool.js";

export interface AerospaceCommand<Schema extends z.ZodObject = z.ZodObject>
  extends Omit<Tool<Schema>, "handle"> {
  command: string;
  json?: boolean;
  toArgs(input: z.output<Schema>): string[];
}

export function defineAerospaceTool<Schema extends z.ZodObject>({
  command,
  json = false,
  toArgs,
  ...tool
}: AerospaceCommand<Schema>): Tool<Schema> {
  return {
    ...tool,
    handle: (input, runners) =>
      runCommand(runners.aerospace, toAerospaceCommandArgs(command, toArgs(input), json), json),
  };
}

export function toAerospaceCommandArgs(command: string, args: string[], json: boolean): string[] {
  return json ? [command, ...args, "--json"] : [command, ...args];
}
