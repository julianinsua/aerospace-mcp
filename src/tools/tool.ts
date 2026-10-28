import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Runner } from "../process.js";

export interface AerospaceTool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  command: string;
  description: string;
  inputSchema: Schema;
  readOnly: boolean;
  json?: boolean;
  hintDestructive?: boolean;
  toArgs(input: z.output<Schema>): string[];
}

export function defineTool<Schema extends z.ZodObject>(
  tool: AerospaceTool<Schema>,
): AerospaceTool<Schema> {
  return tool;
}

function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

export async function runCommand(
  runner: Runner,
  args: string[],
  parseJson: boolean,
): Promise<CallToolResult> {
  try {
    const result = await runner.run(args);
    const invocation = ["aerospace", ...args].join(" ");
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || "no output";
      return toolError(`${invocation} exited with code ${result.code}: ${detail}`);
    }
    if (!parseJson) {
      return { content: [{ type: "text", text: "success" }] };
    }
    try {
      const parsed: unknown = JSON.parse(result.stdout);
      return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      return toolError(`${invocation} returned invalid JSON: ${message}`);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export function toCommandArgs(tool: AerospaceTool, input: z.output<z.ZodObject>): string[] {
  const args = [tool.command, ...tool.toArgs(input)];
  return tool.json ? [...args, "--json"] : args;
}

const confirmationField = {
  confirm: z
    .literal(true)
    .describe("Must be true. Only set it after the user has explicitly asked for this action"),
};

export function registerAerospaceTool(
  server: McpServer,
  runner: Runner,
  tool: AerospaceTool,
): void {
  const json = tool.json ?? false;
  const hintDestructive = tool.hintDestructive ?? false;
  const inputSchema = hintDestructive
    ? tool.inputSchema.extend(confirmationField)
    : tool.inputSchema;
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: inputSchema.strict(),
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: hintDestructive },
    },
    async (input) => runCommand(runner, toCommandArgs(tool, input), json),
  );
}
