# aerospace-mcp

Local [MCP](https://modelcontextprotocol.io) server that controls the [AeroSpace](https://github.com/nikitabobko/AeroSpace) window manager by spawning its command-line tool. Stdio transport only.

Tools: `list_workspaces`, `list_windows` (read-only), `move_window`, `move_window_to_workspace`.

## Requirements

- Node 24 (see `.nvmrc`). `engines` allows Node `>=22`.
- pnpm 10.18 (`packageManager` in `package.json`)
- AeroSpace 0.21.3-Beta. Tool flags follow that version's `--help`, and older versions reject some of them (for example `move --fail-if-fullscreen`). This machine has it at `/opt/homebrew/bin/aerospace`. MCP clients often start servers with a short `PATH`, so set `AEROSPACE_BIN`.

## Setup

```sh
pnpm install
pnpm build
```

`pnpm dev` runs `tsx watch src/index.ts` (stdio). `pnpm start` runs `node dist/index.js`.

```sh
pnpm test
pnpm check
pnpm format
```

Inspect the server:

```sh
pnpm dlx @modelcontextprotocol/inspector node dist/index.js
```

## Cursor

Build first, then add this to `~/.cursor/mcp.json` (path is this checkout):

```json
{
  "mcpServers": {
    "aerospace": {
      "command": "node",
      "args": ["/Users/julianinsua/code/aerospace-mcp/dist/index.js"],
      "env": {
        "AEROSPACE_BIN": "/opt/homebrew/bin/aerospace"
      }
    }
  }
}
```

## Behavior

Each tool runs one `aerospace` subcommand. Read-only tools append `--json` and return AeroSpace's JSON. The list tools also pass `--format`, so each entry carries its context:

- `list_workspaces`: `workspace`, `workspace-is-focused`, `workspace-is-visible`, `monitor-id`, `monitor-name`, `workspace-root-container-layout`.
- `list_windows`: `window-id`, `app-name`, `app-bundle-id`, `app-pid`, `window-title`, `window-is-fullscreen`, `workspace`, `monitor-id`.

Both list tools default to the focused monitor, as AeroSpace's docs recommend for automation. Pass `monitor: "all"` or `scope: "all"` to see every monitor. Workspace arguments are names (strings such as `"1"` or `"S"`). `move_window_to_workspace` sends a name after `--`, and treats `"next"` / `"prev"` as steps. Mutating tools return `success` when AeroSpace exits 0. The binary comes from `AEROSPACE_BIN`, or `aerospace` on `PATH`. Stdin is closed, because AeroSpace waits on an open stdin pipe. The command times out after 5 seconds. A missing binary, a timeout, a non-zero exit, or invalid JSON becomes a tool error. Logs go to stderr.

## Adding a tool

Each tool is one module in `src/tools/` built with `defineTool`: MCP name, AeroSpace subcommand, description, Zod input schema, `readOnly`, and `toArgs(input)` returning the arguments after the subcommand. Use the `option`, `flag`, `toggle` and `format` helpers from `src/tools/args.ts`. Add the tool to the list in `src/tools/index.ts` and an argv case to `test/tools.test.ts`. `registerAerospaceTool` handles registration, `--json`, the `readOnlyHint` annotation and error mapping.

## Mutations

Planned rule: tools that change windows, focus, layout, or reload config stay unregistered unless `AEROSPACE_ALLOW_MUTATIONS=1`, and `close` / `close-all-windows-but-current` require `confirm: true`. Not enforced yet: `move_window` and `move_window_to_workspace` are always registered.
