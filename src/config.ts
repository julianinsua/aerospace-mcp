import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import { isNotFound } from "./utils/errors.js";

export const openerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("applescript"), command: z.string() }).strict(),
  z.object({ type: z.literal("exec"), bin: z.string(), args: z.array(z.string()) }).strict(),
  z.object({ type: z.literal("newInstance"), args: z.array(z.string()) }).strict(),
]);

export type Opener = z.infer<typeof openerSchema>;

export const configSchema = z
  .object({
    openers: z.record(z.string(), openerSchema).default({}),
  })
  .strict();

export type Config = z.infer<typeof configSchema>;

// XDG_CONFIG_HOME only counts when it is absolute, as the XDG spec requires
export const defaultConfigPath = (env: NodeJS.ProcessEnv = process.env): string => {
  const xdgConfigHome = env.XDG_CONFIG_HOME;
  const configHome =
    xdgConfigHome && isAbsolute(xdgConfigHome) ? xdgConfigHome : join(homedir(), ".config");
  return join(configHome, "aerospace-mcp", "config.json");
};

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : `unknown error: ${String(e)}`;

export async function loadConfig(path?: string, env = process.env) {
  const file = path ?? defaultConfigPath(env);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (e) {
    if (!path && isNotFound(e)) {
      return { openers: {} };
    }
    throw new Error(`cannot read config ${file}: ${errorMessage(e)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`config file ${file} is not valid JSON: ${errorMessage(e)}`);
  }

  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`invalid config ${file}: \n ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
