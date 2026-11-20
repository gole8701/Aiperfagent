# @perfagent/mcp

PerfAgent as an MCP server, so your AI assistant (Claude Code, Claude Desktop, Cursor, VS Code Copilot, Windsurf, Cline, Zed, ChatGPT connectors) can scan, explain and compare performance problems in your project.

```bash
npx perfagent mcp                      # stdio, read-only (default)
npx perfagent mcp --allow-writes       # adds apply_fix_to_branch
npx perfagent mcp --http --port 4546   # Streamable HTTP on 127.0.0.1
npx perfagent mcp --http --host 0.0.0.0 --port 4546   # reachable from other machines (opt-in)
```

## Tools (read-only)

| Tool | What it does |
|---|---|
| `scan_url {url, device?, runs?}` | Measure any public URL and list the problems found |
| `scan_project {urls?}` | Scan the project source and configured pages; saves a report |
| `list_issues {reportId?, filter?, route?}` | Problems, filtered by chip (`metric:lcp`, `area:bundle`) or route |
| `explain_issue {issueId, reportId?, useAi?}` | Root-cause chain, why, framework rule, gain, steps, before/after, docs |
| `get_file_context {file, line?, radius?}` | A redacted window of a project file (path-guarded) |
| `suggest_fix {issueIds, reportId?}` | Proposed code changes from your configured AI; nothing is applied |
| `compare_runs {a, b}` | Before/after comparison of two reports |
| `ai_report {}` | AI performance measured by `watchAI` / the proxy |
| `open_dashboard {}` | URL of the running local dashboard |

Resources: `perfagent://report/latest` (JSON) and `perfagent://guide/<topic>` (Markdown guide pages such as `lcp`, `inp`, `bundle`).

Every tool answers plain JSON text. Inputs are validated with zod; errors come back as `isError` results with PerfAgent's message and next-step hint.

## Optional write tool

`apply_fix_to_branch {reportId, issueIds, review: false}` exists **only** when the server is started with `--allow-writes`. It runs the fix loop on a new `perfagent/fix-<date>` git branch (never `main`, never pushed), runs your project's checks and reports the result. Assistants ask for your approval before each call; treat each use as a code change you review afterwards.

## Remote (Streamable HTTP) and ChatGPT

The HTTP transport listens on `http://127.0.0.1:4546/mcp` and requires a bearer token on every request:

- Set `PERFAGENT_MCP_TOKEN=<your-secret>` before starting, or copy the random token printed at start.
- Clients send `Authorization: Bearer <token>`.
- A missing or wrong token gets `401` with a `WWW-Authenticate: Bearer …` header, so OAuth-capable clients know a credential is required.

**Full OAuth (authorization server, dynamic client registration) is out of scope for this version.** Bearer tokens are enough for a single developer or a small team behind a VPN or an HTTPS reverse proxy.

ChatGPT connector steps:

1. Start the server reachable over HTTPS, e.g. behind a reverse proxy: `PERFAGENT_MCP_TOKEN=... npx perfagent mcp --http --port 4546` and proxy `https://perf.example.com/mcp` → `http://127.0.0.1:4546/mcp`.
2. In ChatGPT → Settings → Connectors → Add, enter the `/mcp` URL and choose "Custom header" / API key authentication with `Authorization: Bearer <token>` (the exact wording changes between ChatGPT versions; the connector needs to send that header).
3. Ask ChatGPT: "Use PerfAgent to list the LCP problems in the latest report and explain the biggest one."

## Safety

- Read-only by default; the write tool is opt-in per start.
- Path guard: only files inside the project root, never `.env`, keys or `node_modules`.
- Secrets are redacted from every file window and every report.
- Local stdio mode listens on nothing; HTTP binds to `127.0.0.1` unless `--host 0.0.0.0` is given.
- When bound to all interfaces, `scan_url` refuses loopback and private targets so the server cannot be used to probe its host's network.
