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
  .default("all")
  .describe("Which monitor is targeted");

export const workspaceSchema = z
  .xor([z.number(), z.enum(["focused", "visible"])])
  .describe(
    "Either the workspace number, focused for the currently focused window, or visible for windows in the currently visible workspace",
  );

export const directionSchema = z.enum(["left", "down", "up", "right"]);

export const stepSchema = z.enum(["next", "prev"]);

export const boundariesSchema = z
  .enum(["workspace", "all-monitors-outer-frame"])
  .describe(
    "How the movement should be confined. If set to workspace, the window moves only inside the current monitor workspace. If set to all-monitors-outer-frame, the window can move to adjacent monitors' workspaces",
  );

export const boundariesActionSchema = z.enum(["stop", "fail", "create-implicit-container"]);

export const windowIdSchema = z.number().int();
