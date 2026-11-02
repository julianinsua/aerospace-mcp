# aerospace-mcp

Local [MCP](https://modelcontextprotocol.io) server that controls the [AeroSpace](https://github.com/nikitabobko/AeroSpace) window manager by spawning its command-line tool. Stdio transport only.

Tools:

- Read-only, always available: `list_monitors`, `list_workspaces`, `list_windows`, `list_apps`, `list_installed_apps`, `list_modes`, `get_config`, and the focus tools `focus_window`, `focus_back_and_forth`, `focus_monitor`, `switch_workspace`, `workspace_back_and_forth` (they change focus, not the window tree).
- Mutating, only with `--allow-mutations`: `move_window`, `summon_workspace`, `move_workspace_to_monitor`, `move_window_to_workspace`, `move_window_to_monitor`, `open_app` (launches an app, or opens a new window of one that is running), `close_window` (destructive, requires `confirm: true`).

## Requirements

- macOS with AeroSpace 0.21.3-Beta. Tool flags follow that version's `--help`, and older versions reject some of them (for example `move --fail-if-fullscreen`).
- Node 22 or newer, for `npx`.

## Connecting agents

Cursor and Claude Desktop use the same entry. Leave out `--allow-mutations` for a server that can only read and change focus:

```json
{
  "mcpServers": {
    "aerospace": {
      "command": "npx",
      "args": ["-y", "aerospace-mcp", "--allow-mutations"]
    }
  }
}
```

- **Cursor** (editor and `agent` CLI): add it to `~/.cursor/mcp.json`. `agent mcp list-tools aerospace` shows 17 tools with mutations on and 11 without.
- **Claude Desktop**: add `mcpServers` to `~/Library/Application Support/Claude/claude_desktop_config.json`, then quit and reopen the app.
- **Claude Code**: register it for all projects with

  ```sh
  claude mcp add --scope user aerospace -- npx -y aerospace-mcp --allow-mutations
  ```

  `claude mcp get aerospace` checks the connection. Use `--scope project` to share it through a `.mcp.json` in one repo instead.
- **pi** with the Cursor provider (`pi-cursor-sdk`): it loads `~/.cursor/mcp.json`, so the Cursor entry is enough. Adding the server to `~/.pi/agent/mcp.json` as well gives the model a second copy of every tool.

GUI clients such as Cursor and Claude Desktop can start servers with a short `PATH` when launched from the Dock. If a client reports that it cannot find `npx`, use its absolute path from `which npx` as the `command`.

### Defaults

| Setting | Default | Change it with |
|---|---|---|
| Tools exposed | Read-only and focus tools only. The move tools and `close_window` are not registered | `--allow-mutations` in `args`, or `AEROSPACE_ALLOW_MUTATIONS=1` in `env` |
| AeroSpace binary | `aerospace` on the server's `PATH`, then `/opt/homebrew/bin/aerospace`, then `/usr/local/bin/aerospace` | `AEROSPACE_BIN=/absolute/path/to/aerospace` in `env` |
| Config file | `~/.config/aerospace-mcp/config.json` if it exists, otherwise none | `--config /absolute/path.json` in `args`, or `AEROSPACE_MCP_CONFIG=/absolute/path.json` in `env`, see [Configuration](#configuration) |
| Tool approval | Each client asks before every tool call | The client's allowlist, see [Tool approval](#tool-approval) |
| `close_window` | Requires `confirm: true` in the call | Not configurable |

### Tool approval

By default every client asks before each call. To let agents move windows on command, allowlist every tool except `close_window`, which keeps asking:

- **Cursor editor**: `~/.cursor/permissions.json`. It takes effect in the Auto-review and Allowlist run modes, and when the file defines `mcpAllowlist` it replaces the MCP allowlist in Settings, so copy any existing entries into it. Entries are `server:tool` and accept `*`. These patterns match every tool except `close_window`, and also any future tool that shares a prefix:

  ```json
  {
    "mcpAllowlist": [
      "aerospace:list_*",
      "aerospace:get_*",
      "aerospace:focus_*",
      "aerospace:switch_*",
      "aerospace:workspace_*",
      "aerospace:move_*",
      "aerospace:summon_*",
      "aerospace:open_*"
    ]
  }
  ```

- **Cursor CLI**: each tool in `permissions.allow` of `~/.cursor/cli-config.json`, written `Mcp(aerospace:move_window)`. A `deny` entry blocks a tool outright rather than asking, so leave `close_window` out instead.
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

## Configuration

The server reads an optional JSON config file once at startup, from the first of:

1. `--config /absolute/path.json` in `args`.
2. `AEROSPACE_MCP_CONFIG=/absolute/path.json` in `env`.
3. `$XDG_CONFIG_HOME/aerospace-mcp/config.json` when `XDG_CONFIG_HOME` is an absolute path, otherwise `~/.config/aerospace-mcp/config.json`.

```json
"args": ["-y", "aerospace-mcp", "--allow-mutations", "--config", "/Users/you/aerospace-mcp.json"]
```

MCP clients start the server without a shell, so `~` and `$HOME` in the path are not expanded. Use an absolute path.

If the default file does not exist, the server starts without a config. These stop the server at startup:

- a file named by `--config` or `AEROSPACE_MCP_CONFIG` that cannot be read;
- a file that is not valid JSON;
- a file that does not match the format below, including unknown keys.

The error, with the path to the field that is wrong, goes to stderr, where the client's MCP logs show it. Restart the server after editing the file.

[`config.example.json`](config.example.json) is a complete example.

### Configuring apps

`openers` maps an app's bundle id to the way `open_app` asks that app for a new window while it is running. It is not used for an app that is not running: `open_app` launches that app with `open -g -b`, which opens its first window. An opener in the config replaces the built-in one for that app (Chrome, Safari, Finder and Terminal have one) and is used instead of the scripting dictionary lookup. Find bundle ids with `list_apps` or `list_installed_apps`.

Each opener has a `type`:

| `type` | Fields | Runs |
|---|---|---|
| `applescript` | `command` | `osascript`, telling the app to run `command`, for example `make new window` |
| `exec` | `bin`, `args` | `bin` with `args`, without a shell |
| `newInstance` | `args` | `open -n -g -b <bundleId> --args <args>`, a second instance of the app |

`bin` and `args` can contain `{bundlePath}` (the app's bundle path, such as `/Applications/kitty.app`) and `{pid}` (the running app's process id). Each argument is filled in separately, so a value with spaces stays one argument. `bin` must be an absolute path once `{bundlePath}` is filled in. AppleScript commands that use an app's own terms have to be written as raw codes, as described under [Behavior](#behavior).

The server runs these commands with your user's permissions. A model calling `open_app` only picks the bundle id; it cannot change what an opener runs.

#### kitty

kitty has no AppleScript support, but its remote control can open a window with `kitten @ launch --type=os-window`. The MCP server does not run inside a kitty window, so `kitten` has to reach kitty through a socket.

1. Turn on remote control and the socket in `~/.config/kitty/kitty.conf`:

   ```conf
   allow_remote_control yes
   listen_on unix:/tmp/mykitty
   ```

2. Quit kitty with Cmd+Q and open it again. kitty reads `listen_on` only when it starts, and on macOS closing the last window leaves kitty running. kitty appends its process id to the socket path, so `ls /tmp/mykitty-*` should now show one socket.

3. Add the opener to the config file:

   ```json
   {
     "openers": {
       "net.kovidgoyal.kitty": {
         "type": "exec",
         "bin": "{bundlePath}/Contents/MacOS/kitten",
         "args": ["@", "--to", "unix:/tmp/mykitty-{pid}", "launch", "--type=os-window"]
       }
     }
   }
   ```

   The `--to` address is the `listen_on` value with `-{pid}` appended, the same suffix kitty adds. If you change `listen_on`, change it here too. If `listen_on` contains `{kitty_pid}`, kitty puts the process id there instead of appending it, so write the same path with `{pid}` in that place.

4. Restart the MCP server so it reads the config.

`open_app` with `net.kovidgoyal.kitty` now opens a new kitty OS window and returns its window id. An error such as `kitten exited with code 1: Error: Failed to connect to unix:/tmp/mykitty-<pid>` means the socket does not exist: kitty has not been restarted since `listen_on` was added, or the two paths do not match.

With `allow_remote_control yes` and a socket, any process running as your user can control kitty, including running commands in its windows.

## Development

- Node 24 (see `.nvmrc`). `engines` allows Node `>=22`.
- pnpm 10.18 (`packageManager` in `package.json`)

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

Inspect the server, with or without `--allow-mutations`:

```sh
pnpm dlx @modelcontextprotocol/inspector node dist/index.js --allow-mutations
```

To run a checkout from an agent, point the server entry at the build instead of `npx`, and rebuild and restart the server after each change:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/aerospace-mcp/dist/index.js", "--allow-mutations"]
}
```

### Releasing

Bump `version` in `package.json`, commit, then push a matching tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```

`.github/workflows/release.yml` checks that the tag matches the version, runs the checks and publishes to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is stored in the repo.

## Behavior

Each tool except `list_installed_apps` and `open_app` runs one `aerospace` subcommand. Tools with `json: true` (the list tools and `get_config`) append `--json` and return AeroSpace's JSON. The list tools also pass `--format`, so each entry carries its context:

- `list_monitors`: `monitor-id`, `monitor-name`, `monitor-is-main`.
- `list_workspaces`: `workspace`, `workspace-is-focused`, `workspace-is-visible`, `monitor-id`, `monitor-name`, `workspace-root-container-layout`.
- `list_windows`: `window-id`, `app-name`, `app-bundle-id`, `app-pid`, `window-title`, `window-is-fullscreen`, `workspace`, `monitor-id`.
- `list_apps`: `app-pid`, `app-bundle-id`, `app-name`.

`list_installed_apps` lists apps that are installed but not necessarily running, so an agent can find a bundle id before the app has a window. It asks Spotlight with `mdfind` for app bundles in `/Applications` and `/System/Applications` (including subfolders such as `Utilities`), then reads every bundle id and display name with one `mdls -raw` call. Each entry has `app-bundle-id`, `app-name` and `app-path`, sorted by name. Apps without a bundle id are skipped. If Spotlight indexing is off, `mdfind` finds nothing and the tool returns an error saying so.

`open_app` checks `list-apps` to see whether the app is running; `list-windows` alone cannot tell, because running apps such as Finder can have no windows. An app that is not running is launched with `open -g -b <bundleId>`. A running app is asked for a new window by its opener, which is one of three types:

- `applescript` runs `osascript -e 'tell application id (item 1 of argv) to <command>' <bundleId>`, so the bundle id is passed as data and the command is always one of a fixed set.
- `exec` runs a program with a fixed argument list, without a shell. Its `bin` must be an absolute path.
- `newInstance` runs `open -n -g -b <bundleId> --args <args>`, which starts a second instance of the app with those arguments.

`bin` and `args` can contain `{bundlePath}` and `{pid}`, which are replaced with the running app's bundle path and process id from `list-apps`. An opener from the config file comes first (see [Configuring apps](#configuring-apps)). Otherwise Chrome, Safari, Finder and Terminal have a fixed AppleScript command. For other apps the tool reads the scripting dictionary named by `OSAScriptingDefinition` in the app's `Info.plist`, plus the files it includes from `/System/Library/ScriptingDefinitions`, and uses `make new document` or `make new window` if the `application` class has a writable element of that type. Commands that use an app's own terms are written as raw codes (`make new «class brow»` for a Finder window, `«event coredosc» ""` for Terminal's `do script`), because the target app is only known at run time and AppleScript cannot compile its terms otherwise.

After launching or asking, the tool polls `list-windows --monitor all --app-bundle-id <bundleId>` every 150 ms until a window id appears that was not there before, or `timeoutMs` (default 10000, at most 30000) runs out. It returns the new windows with `window-id`, `window-title` and `workspace`. New windows appear on the focused workspace. These become tool errors: an unknown bundle id (`open` exits 1), a running app without a supported command, macOS refusing automation (`-1743`, which the user fixes under System Settings > Privacy & Security > Automation), any other `osascript` failure, an `exec` or `newInstance` opener that exits with a non-zero code (for kitty, usually a missing socket), and no new window before the timeout. The first request to each app shows the macOS automation prompt, so `osascript` gets 60 seconds instead of 5.

`list_modes` returns `mode-id` entries. `get_config` runs `config --get <name> --json` (plus `--keys` to list a map's keys). AeroSpace 0.21.3 only exposes `mode.*` keys there, such as `mode.main.binding`; other keys fail with `No value at key token`. The text-only forms `--major-keys`, `--all-keys` and `--config-path` are not exposed; `name: "."` with `keys: true` lists the top-level keys instead.

`list_workspaces` and `list_windows` default to the focused monitor, as AeroSpace's docs recommend for automation. Pass `monitor: "all"` or `scope: "all"` to see every monitor. Workspace arguments are names (strings such as `"1"` or `"S"`). `move_window_to_workspace` sends a name after `--`, and treats `"next"` / `"prev"` as steps. Tools without JSON output (the focus tools and the mutating tools) return `success` when AeroSpace exits 0. The binary comes from `AEROSPACE_BIN`, or `aerospace` on `PATH` or in the Homebrew prefixes. Stdin is closed, because AeroSpace waits on an open stdin pipe. The command times out after 5 seconds. A missing binary, a timeout, a non-zero exit, or invalid JSON becomes a tool error. Exit and JSON errors start with the command that ran, for example `aerospace move right exited with code 1: <stderr>`. Logs go to stderr.

## Adding a tool

Each tool is one module in `src/tools/`. A tool that wraps one AeroSpace subcommand uses `defineAerospaceTool`: MCP name, AeroSpace subcommand, description, Zod input schema, `readOnly` (required), and `toArgs(input)` returning the arguments after the subcommand. `json` (the subcommand supports `--json`) and `hintDestructive` are optional and default to `false`; set them only when they are `true`. Use the `option`, `flag`, `toggle` and `format` helpers from `src/tools/args.ts`. `defineAerospaceTool` builds the tool's `handle`, which adds `--json` and parses the output for `json: true` and maps errors.

A tool that runs other programs uses `defineTool` and writes `handle(input, runners, config)` itself, as `list_installed_apps` does. `runners` (`src/runners.ts`) holds one runner per binary, so tests can pass fakes; add a field there for a new binary. `runners.exec(bin)` returns a runner for a binary that is only known at run time. `config` is the parsed config file (`src/config.ts`).

Add the tool to the list in `src/tools/index.ts` and tests: an argv case in `test/tools.test.ts` for AeroSpace tools, or a test file of its own. `registerTool` handles registration, the `readOnlyHint` and `destructiveHint` annotations and the `confirm` field for every tool.

## Mutations

Tools with `readOnly: false` change the window tree and are registered only when the server starts with `--allow-mutations` or `AEROSPACE_ALLOW_MUTATIONS=1`. Focus changes count as read-only. Without either, the server exposes the read-only tools only. Unknown command-line flags stop the server at startup, so a typo does not silently drop the mutating tools. `createServer(runners, { allowMutations, config })` sets the gate and the config directly, which the tests use. Without `config` the server has no user openers.

Tools with `hintDestructive: true` (currently `close_window`) also get the `destructiveHint` annotation and a required `confirm` argument that must be `true`. A call without it fails validation before AeroSpace runs. This is a guard against accidental calls, not a security boundary: a model can still send `confirm: true`. Moving windows is reversible, so the move tools are not marked destructive.
