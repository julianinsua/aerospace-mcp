import { z } from "zod";

export const option = (name: string, value: string | number | undefined): string[] =>
  value === undefined ? [] : [`--${name}`, String(value)];

export const flag = (name: string, enabled: boolean | undefined): string[] =>
  enabled ? [`--${name}`] : [];

// For AeroSpace options spelled `--name [no]`: true sends `--name`, false sends `--name no`.
export const toggle = (name: string, value: boolean | undefined): string[] => {
  if (value === undefined) {
    return [];
  }
  return value ? [`--${name}`] : [`--${name}`, "no"];
};

export const format = (...variables: string[]): string[] => [
  "--format",
  variables.map((variable) => `%{${variable}}`).join(" "),
];

export const scopeSchema = z.enum(["all", "focused"]);

export const monitorSchema = z
  .xor([z.number().int().min(1), z.enum(["all", "mouse", "focused"])])
  .describe(
    "Monitor to target: a 1-based index counting monitors from left to right, all for every monitor, focused for the monitor that has focus, or mouse for the monitor under the mouse pointer",
  );

export const workspaceSchema = z
  .string()
  .min(1)
  .describe(
    'Workspace name as returned by list_workspaces (for example "1" or "S"). The special names focused and visible select the focused workspace or all currently visible workspaces',
  );

export const directionSchema = z
  .enum(["left", "down", "up", "right"])
  .describe("Direction to move the window in");

export const stepSchema = z.enum(["next", "prev"]);

export const dfsStepSchema = z.enum(["dfs-next", "dfs-prev"]);

export const boundariesSchema = z
  .enum(["workspace", "all-monitors-outer-frame"])
  .describe(
    "How far the window may move. workspace (the default) keeps it inside its current workspace. all-monitors-outer-frame lets it cross onto the workspace of the adjacent monitor",
  );

export const moveBoundariesActionSchema = z
  .enum(["stop", "fail", "create-implicit-container"])
  .describe(
    "What to do when the window reaches the boundary: stop does nothing, fail exits with an error, create-implicit-container (the default) wraps the windows in a new container",
  );

export const focusBoundariesActionSchema = z
  .enum(["stop", "fail", "wrap-around-the-workspace", "wrap-around-all-monitors"])
  .describe(
    "What to do when focus would cross the boundary: stop does nothing, fail exits with an error, wrap-around-the-workspace jumps to the opposite edge of the workspace, wrap-around-all-monitors jumps to the opposite edge across all monitors (direction targets only)",
  );

export const windowIdSchema = z
  .number()
  .int()
  .describe("Act on this window instead of the focused one. Ids come from list_windows");
