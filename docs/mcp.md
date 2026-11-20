# MCP server

`npx perfagent mcp` runs PerfAgent as a Model Context Protocol server, so an AI assistant can scan a project, list problems and explain them with real measurements and file:line evidence. The assistant uses its own model and your subscription; PerfAgent has no keys of its own.

## Transports

| Mode            | Command                                | For                                                                                                                                  |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| stdio (default) | `npx perfagent mcp`                    | Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot, Cline, Zed                                                           |
| Streamable HTTP | `npx perfagent mcp --http --port 4546` | ChatGPT connectors, teams. Serves `/mcp` on `127.0.0.1` by default; every request needs `Authorization: Bearer <token>` (see Safety). |

Options: `--root <path>` to point at another project; `--allow-writes` to enable the write tool; with `--http`, `--port` (default 4546) and `--host` (default `127.0.0.1`).

## Tools

Read-only by default. All return JSON text; errors come back as tool errors with a hint, not protocol failures. `reportId` is optional where shown and defaults to the latest report.

| Tool                                               | Input                                                           | Returns                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `scan_url`                                         | `{ url, device?: 'mobile' \| 'desktop', runs?: 1–5 }`           | Measures one URL from the outside and saves a report: report id, pages, issues     |
| `scan_project`                                     | `{ urls?: string[] (max 20) }`                                  | Scans the project source (and `urls` or the configured URLs); report id, framework, pages, issues |
| `list_issues`                                      | `{ reportId?, filter?: 'metric:lcp' \| 'area:bundle', route? }` | Issue summaries with file:line, severity, gain and whether an automatic fix exists |
| `explain_issue`                                    | `{ issueId, reportId?, useAi? }`                                | The full issue (chain, why, steps, before/after); with `useAi`, also an AI explanation |
| `get_file_context`                                 | `{ file, line?, radius?: 1–200 (default 30) }`                  | Lines around `line` of a project file; path-guarded and secrets redacted            |
| `suggest_fix`                                      | `{ issueIds (1–10), reportId? }`                                | Proposed code changes from the configured AI; nothing is applied                    |
| `compare_runs`                                     | `{ a, b }` (report ids)                                         | Verdict, diffs and impact                                                           |
| `ai_report`                                        | `{}`                                                            | AI calls measured by `watchAI` or the proxy: first-token p50/p95, cost, error rate  |
| `open_dashboard`                                   | `{}`                                                            | The URL of the running local dashboard, if any                                      |
| `apply_fix_to_branch` (only with `--allow-writes`) | `{ reportId, issueIds (1–20) }`                                 | Applies fixes without the dashboard review step on a new `perfagent/fix-<date>` branch through the fixer, runs the project checks; never pushes. Only offered when the server also has a fix service |

Resources: `perfagent://report/latest` (the latest report as JSON) and `perfagent://guide/<topic>` (a built-in guide as Markdown, e.g. `lcp`, `chips`).

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
- Without `--allow-writes` there is no tool that can change a file. `--allow-writes` is ignored outside local mode (bound to a non-loopback `--host`, `NODE_ENV=production`, or no git repository), the same rule as the dashboard's write routes. With it, changes go to a new branch only; there is no tool to commit to `main`, push, merge or deploy.
- Content the tools return (page text, file snippets) is data; prompt injection in a scanned page can only produce text for the assistant to read, not actions in PerfAgent.
- The HTTP transport binds to `127.0.0.1` unless you pass `--host`, and every request needs `Authorization: Bearer <token>`. Set the token with `PERFAGENT_MCP_TOKEN`; otherwise a random one is printed to stderr at start. Full OAuth is not implemented: put a reverse proxy in front if a client needs it. `scan_url` refuses private network addresses, and also loopback addresses when the server listens on another interface.
