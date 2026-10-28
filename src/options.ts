import { parseArgs } from "node:util";

export interface ServerOptions {
  allowMutations: boolean;
}

export function serverOptions(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): ServerOptions {
  const { values } = parseArgs({
    args: argv,
    options: { "allow-mutations": { type: "boolean" } },
    strict: true,
  });
  return {
    allowMutations: values["allow-mutations"] === true || env.AEROSPACE_ALLOW_MUTATIONS === "1",
  };
}
