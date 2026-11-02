import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Config } from "../config.js";
import { exitFailure, type Runner } from "../process.js";
import type { Runners } from "../runners.js";

export interface Tool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  inputSchema: Schema;
  readOnly: boolean;
  hintDestructive?: boolean;
  handle(input: z.output<Schema>, runners: Runners, config: Config): Promise<CallToolResult>;
}

export function defineTool<Schema extends z.ZodObject>(tool: Tool<Schema>): Tool<Schema> {
  return tool;
}

export function toolError(text: string): CallToolResult {
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
      return toolError(exitFailure(invocation, result));
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

const confirmationField = {
  confirm: z
    .literal(true)
    .describe("Must be true. Only set it after the user has explicitly asked for this action"),
};

export function registerTool(
  server: McpServer,
  runners: Runners,
  tool: Tool,
  config: Config,
): void {
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
    async (input) => tool.handle(input, runners, config),
  );
}
