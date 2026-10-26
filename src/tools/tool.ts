import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { AerospaceRunner } from "../aerospace.js";

export interface AerospaceTool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  command: string;
  description: string;
  inputSchema: Schema;
  readOnly: boolean;
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
  runner: AerospaceRunner,
  args: string[],
  parseJson: boolean,
): Promise<CallToolResult> {
  try {
    const result = await runner.run(args);
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || "no output";
      return toolError(`aerospace exited with code ${result.code}: ${detail}`);
    }
    if (!parseJson) {
      return { content: [{ type: "text", text: "success" }] };
    }
    try {
      const parsed: unknown = JSON.parse(result.stdout);
      return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      return toolError(`aerospace returned invalid JSON: ${message}`);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export function toCommandArgs(tool: AerospaceTool, input: z.output<z.ZodObject>): string[] {
  const args = [tool.command, ...tool.toArgs(input)];
  return tool.readOnly ? [...args, "--json"] : args;
}

export function registerAerospaceTool(
  server: McpServer,
  runner: AerospaceRunner,
  tool: AerospaceTool,
): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly },
    },
    async (input) => runCommand(runner, toCommandArgs(tool, input), tool.readOnly),
  );
}
