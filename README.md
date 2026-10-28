# aerospace-mcp

Local [MCP](https://modelcontextprotocol.io) server that controls the [AeroSpace](https://github.com/nikitabobko/AeroSpace) window manager by spawning its command-line tool. Stdio transport only.

Tools:

- Read-only, always available: `list_monitors`, `list_workspaces`, `list_windows`, `list_apps`, `list_modes`, `get_config`, and the focus tools `focus_window`, `focus_back_and_forth`, `focus_monitor`, `switch_workspace`, `workspace_back_and_forth` (they change focus, not the window tree).
- Mutating, only with `AEROSPACE_ALLOW_MUTATIONS=1`: `move_window`, `summon_workspace`, `move_workspace_to_monitor`, `move_window_to_workspace`, `move_window_to_monitor`, `close_window` (destructive, requires `confirm: true`).

## Requirements

- Node 24 (see `.nvmrc`). `engines` allows Node `>=22`.
- pnpm 10.18 (`packageManager` in `package.json`)
- AeroSpace 0.21.3-Beta. Tool flags follow that version's `--help`, and older versions reject some of them (for example `move --fail-if-fullscreen`). Homebrew installs it at `/opt/homebrew/bin/aerospace`. MCP clients often start servers with a short `PATH`, so set `AEROSPACE_BIN` (see [Connecting agents](#connecting-agents)).

## Setup

```sh
pnpm install
pnpm build
```

`pnpm dev` runs `tsx watch src/index.ts` (stdio). `pnpm start` runs `node dist/index.js`.

```sh
pnpm test
pnpm check
pnpm typecheck
pnpm format
```

`pnpm typecheck` type-checks `src` and `test` without emitting (`tsconfig.test.json`). `pnpm build` uses `tsconfig.json`, which covers `src` only.

Inspect the server:

```sh
pnpm dlx @modelcontextprotocol/inspector node dist/index.js
```

To see the mutating tools in the inspector, set `AEROSPACE_ALLOW_MUTATIONS=1` in the server's environment variables before connecting.

## Connecting agents

Run `pnpm build` first: clients start `dist/index.js`, not the sources. After changing the server, rebuild and restart it in each client.

### Defaults

| Setting | Default | Change it with |
|---|---|---|
| Tools exposed | Read-only and focus tools only. The move tools and `close_window` are not registered | `AEROSPACE_ALLOW_MUTATIONS=1` in the server's `env` |
| AeroSpace binary | `aerospace` on the server's `PATH` | `AEROSPACE_BIN=/absolute/path/to/aerospace` |
| Tool approval | Each client asks before every tool call | The client's allowlist, see [Tool approval](#tool-approval) |
| `close_window` | Requires `confirm: true` in the call | Not configurable |

GUI clients such as Cursor and Claude Desktop can start servers with a short `PATH` when launched from the Dock, so use absolute paths for `node` and `AEROSPACE_BIN`. Homebrew installs both under `/opt/homebrew/bin`. A version manager path such as `~/.nvm/versions/node/<version>/bin/node` also works, but breaks when that version is removed.

### Server entry

Cursor and Claude Desktop use the same entry. Replace `/absolute/path/to/aerospace-mcp` with this checkout, and leave out `AEROSPACE_ALLOW_MUTATIONS` for a server that can only read and change focus:

```json
{
  "mcpServers": {
    "aerospace": {
      "command": "/opt/homebrew/bin/node",
      "args": ["/absolute/path/to/aerospace-mcp/dist/index.js"],
      "env": {
        "AEROSPACE_BIN": "/opt/homebrew/bin/aerospace",
        "AEROSPACE_ALLOW_MUTATIONS": "1"
      }
    }
  }
}
```

- **Cursor** (editor and `agent` CLI): add it to `~/.cursor/mcp.json`. `agent mcp list-tools aerospace` shows 17 tools with mutations on and 11 without.
- **Claude Desktop**: add `mcpServers` to `~/Library/Application Support/Claude/claude_desktop_config.json`, then quit and reopen the app.
- **Claude Code**: register it for all projects with

  ```sh
  claude mcp add --scope user aerospace \
    -e AEROSPACE_BIN=/opt/homebrew/bin/aerospace -e AEROSPACE_ALLOW_MUTATIONS=1 \
    -- /opt/homebrew/bin/node /absolute/path/to/aerospace-mcp/dist/index.js
  ```

  `claude mcp get aerospace` checks the connection. Use `--scope project` to share it through a `.mcp.json` in one repo instead.
- **pi** with the Cursor provider (`pi-cursor-sdk`): it loads `~/.cursor/mcp.json`, so the Cursor entry is enough. Adding the server to `~/.pi/agent/mcp.json` as well gives the model a second copy of every tool.

### Tool approval

By default every client asks before each call. To let agents move windows on command, allowlist every tool except `close_window`, which keeps asking:

- **Cursor editor**: `~/.cursor/permissions.json`. It takes effect in the Auto-review and Allowlist run modes, and when the file defines `mcpAllowlist` it replaces the MCP allowlist in Settings, so copy any existing entries into it. Entries are `server:tool`, and `aerospace:*` allows everything:

  ```json
  {
    "mcpAllowlist": [
      "aerospace:list_monitors",
      "aerospace:list_workspaces",
      "aerospace:list_windows",
      "aerospace:list_apps",
      "aerospace:list_modes",
      "aerospace:get_config",
      "aerospace:focus_window",
      "aerospace:focus_back_and_forth",
      "aerospace:focus_monitor",
      "aerospace:switch_workspace",
      "aerospace:workspace_back_and_forth",
      "aerospace:move_window",
      "aerospace:move_window_to_workspace",
      "aerospace:move_window_to_monitor",
      "aerospace:move_workspace_to_monitor",
      "aerospace:summon_workspace"
    ]
  }
  ```

- **Cursor CLI**: the same tools in `permissions.allow` of `~/.cursor/cli-config.json`, written `Mcp(aerospace:move_window)`. A `deny` entry blocks a tool outright rather than asking, so leave `close_window` out instead.
- **Claude Code**: `~/.claude/settings.json`. `ask` takes precedence over `allow`, so the server-wide rule can stay:

  ```json
  {
    "permissions": {
      "allow": ["mcp__aerospace"],
      "ask": ["mcp__aerospace__close_window"]
    }
  }
  ```

- **Claude Desktop**: no config file. Choose "Always allow" on a tool's first prompt, or set each tool's permission in the connector's settings.

New tools are not covered by the explicit Cursor lists; add them when you add a tool.

## Behavior

Each tool runs one `aerospace` subcommand. Tools with `json: true` (the list tools and `get_config`) append `--json` and return AeroSpace's JSON. The list tools also pass `--format`, so each entry carries its context:

- `list_monitors`: `monitor-id`, `monitor-name`, `monitor-is-main`.
- `list_workspaces`: `workspace`, `workspace-is-focused`, `workspace-is-visible`, `monitor-id`, `monitor-name`, `workspace-root-container-layout`.
- `list_windows`: `window-id`, `app-name`, `app-bundle-id`, `app-pid`, `window-title`, `window-is-fullscreen`, `workspace`, `monitor-id`.
- `list_apps`: `app-pid`, `app-bundle-id`, `app-name`.

`list_modes` returns `mode-id` entries. `get_config` runs `config --get <name> --json` (plus `--keys` to list a map's keys). AeroSpace 0.21.3 only exposes `mode.*` keys there, such as `mode.main.binding`; other keys fail with `No value at key token`. The text-only forms `--major-keys`, `--all-keys` and `--config-path` are not exposed; `name: "."` with `keys: true` lists the top-level keys instead.

`list_workspaces` and `list_windows` default to the focused monitor, as AeroSpace's docs recommend for automation. Pass `monitor: "all"` or `scope: "all"` to see every monitor. Workspace arguments are names (strings such as `"1"` or `"S"`). `move_window_to_workspace` sends a name after `--`, and treats `"next"` / `"prev"` as steps. Tools without JSON output (the focus tools and the mutating tools) return `success` when AeroSpace exits 0. The binary comes from `AEROSPACE_BIN`, or `aerospace` on `PATH`. Stdin is closed, because AeroSpace waits on an open stdin pipe. The command times out after 5 seconds. A missing binary, a timeout, a non-zero exit, or invalid JSON becomes a tool error. Exit and JSON errors start with the command that ran, for example `aerospace move right exited with code 1: <stderr>`. Logs go to stderr.

## Adding a tool

Each tool is one module in `src/tools/` built with `defineTool`: MCP name, AeroSpace subcommand, description, Zod input schema, `readOnly` (required), and `toArgs(input)` returning the arguments after the subcommand. `json` (the subcommand supports `--json`) and `hintDestructive` are optional and default to `false`; set them only when they are `true`. Use the `option`, `flag`, `toggle` and `format` helpers from `src/tools/args.ts`. Add the tool to the list in `src/tools/index.ts` and an argv case to `test/tools.test.ts`. `registerAerospaceTool` handles registration, `--json` and JSON parsing for `json: true`, the `readOnlyHint` and `destructiveHint` annotations, the `confirm` field and error mapping.

## Mutations

Tools with `readOnly: false` change the window tree and are registered only when `AEROSPACE_ALLOW_MUTATIONS=1`. Focus changes count as read-only. Without it, the server exposes the read-only tools only. `createServer(runner, { allowMutations })` overrides the variable, which the tests use.

Tools with `hintDestructive: true` (currently `close_window`) also get the `destructiveHint` annotation and a required `confirm` argument that must be `true`. A call without it fails validation before AeroSpace runs. This is a guard against accidental calls, not a security boundary: a model can still send `confirm: true`. Moving windows is reversible, so the move tools are not marked destructive.
