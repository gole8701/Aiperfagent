# MCP server

`npx perfagent mcp` runs PerfAgent as a Model Context Protocol server, so an AI assistant can scan a project, list problems and explain them with real measurements and file:line evidence. The assistant uses its own model and your subscription; PerfAgent has no keys of its own.

## Transports

| Mode            | Command                                | For                                                                                                       |
| --------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| stdio (default) | `npx perfagent mcp`                    | Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot, Cline, Zed                                |
| Streamable HTTP | `npx perfagent mcp --http --port 4546` | ChatGPT connectors, teams; needs login (OAuth); run on a host you control. Planned for the first release. |

Options: `--root <path>` to point at another project; `--allow-writes` to enable the write tool.

## Tools

Read-only by default. All return the same JSON the dashboard uses (see `docs/api.md`).

| Tool                                               | Input                                                           | Returns                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scan_project`                                     | `{ urls?, device?, runs? }`                                     | The report id and summary                                                     |
| `list_issues`                                      | `{ reportId?, filter?: 'metric:lcp' \| 'area:bundle', route? }` | Issues with file:line, chain, gain and fix                                    |
| `explain_issue`                                    | `{ reportId?, issueId }`                                        | The full issue with why, steps and before/after                               |
| `get_report`                                       | `{ reportId? }`                                                 | The report                                                                    |
| `compare_reports`                                  | `{ a, b }`                                                      | Verdict, diffs and impact                                                     |
| `retest_issue`                                     | `{ reportId, issueId }`                                         | Predicted vs actual                                                           |
| `apply_fix_to_branch` (only with `--allow-writes`) | `{ reportId, issueIds, changes }`                               | Writes to a new `perfagent/fix-<date>` branch through the fixer; never pushes |

The `@perfagent/mcp` package currently exports the `startMcpServer(options)` contract (`config`, `store`, `ai`, `fix`, `transport`, `port`, `allowWrites`, `version`); the server implementation with the tools above is being completed for the first release.

## Client configuration

The exact snippets, as served by `GET /api/ai/mcp-config` and copied by **Settings → AI → AI assistants (MCP) → Copy config**:

```bash
# Claude Code
claude mcp add perfagent -- npx -y perfagent mcp
```

```json
// Claude Desktop (claude_desktop_config.json), Cursor (.cursor/mcp.json),
// Windsurf (~/.codeium/windsurf/mcp_config.json), Cline (cline_mcp_settings.json)
{ "mcpServers": { "perfagent": { "command": "npx", "args": ["-y", "perfagent", "mcp"] } } }
```

```json
// VS Code + GitHub Copilot (.vscode/mcp.json)
{ "servers": { "perfagent": { "command": "npx", "args": ["-y", "perfagent", "mcp"] } } }
```

```json
// Zed (settings.json)
{
  "context_servers": {
    "perfagent": { "command": { "path": "npx", "args": ["-y", "perfagent", "mcp"] } }
  }
}
```

```bash
# ChatGPT (connectors)
npx perfagent mcp --http --port 4546
# then add http://<your-host>:4546/mcp as a connector (needs login; see the guide)
```

Formats change between tool releases; the links in the **Connect an AI assistant (MCP)** guide point to each tool's own documentation.

## Safety

- The server runs in the project folder and reads `perfagent.config.ts` there; the same path guard, redaction and `fix.protected` globs apply as in the dashboard.
- Without `--allow-writes` there is no tool that can change a file. With it, changes go to a new branch only; there is no tool to commit to `main`, push, merge or deploy.
- Content the tools return (page text, file snippets) is data; prompt injection in a scanned page can only produce text for the assistant to read, not actions in PerfAgent.
- The HTTP transport must not be exposed without authentication; it is meant for a reverse proxy or a host with OAuth.
