import { parseArgs } from "node:util";

export interface ServerOptions {
  allowMutations: boolean;
  configPath?: string;
}

export function serverOptions(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ServerOptions {
  const { values } = parseArgs({
    args: argv,
    options: { "allow-mutations": { type: "boolean" }, config: { type: "string" } },
    strict: true,
  });
  return {
    allowMutations: values["allow-mutations"] === true || env.AEROSPACE_ALLOW_MUTATIONS === "1",
    configPath: values.config || env.AEROSPACE_MCP_CONFIG,
  };
}
