---
title: Connect an AI assistant (MCP)
group: Fix & connect
summary: Add PerfAgent as an MCP server so Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot, Cline, Zed or ChatGPT can scan, list and explain problems.
order: 26
tryIt: /settings/ai
---

## What it is

MCP (Model Context Protocol) is the standard way an AI assistant calls tools. `npx perfagent mcp` runs PerfAgent as such a server, so your assistant can ask it to scan the project, list problems and explain them.

The assistant does the writing with its own model and your own subscription; PerfAgent provides the measurements and the file:line evidence. Tools are read-only by default. An optional write tool, `apply_fix_to_branch`, exists only when you start the server with `--allow-writes`, and it still writes to a new branch only.

## Why it matters

You already pay for an assistant. With MCP it fixes performance problems with real data instead of guesses, inside the editor or chat you already use.

## Use case

- "Use PerfAgent to fix all performance issues on /checkout."
- Asking Claude Code to explain why LCP is slow before touching code.
- A reviewer asking Copilot for the problems in the files of a pull request.

## How it helps your app

The assistant sees the same chain, gain and fix as the dashboard, and PerfAgent re-tests after the change. Fixes stay on a branch for your review.

## How to do it in PerfAgent, step by step

1. **Settings:** open **Settings → AI → AI assistants (MCP)** and pick your tool.
2. **Settings:** press **Copy config**. The snippet below is what is copied, in the right format for that tool.
3. **Terminal:** paste it where the tool expects it (file name shown next to the snippet), then restart the tool.
4. **Assistant:** ask: _"Use PerfAgent to scan this project and fix the LCP problems."_ The assistant calls `scan_project`, `list_issues` and `explain_issue`.
5. **Globe:** review the branch it created, re-test, and commit yourself.

## Commands & config

Claude Code (terminal):

```bash
claude mcp add perfagent -- npx -y perfagent mcp
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "perfagent": {
      "command": "npx",
      "args": ["-y", "perfagent", "mcp"]
    }
  }
}
```

Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "perfagent": {
      "command": "npx",
      "args": ["-y", "perfagent", "mcp"]
    }
  }
}
```

Windsurf (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "perfagent": {
      "command": "npx",
      "args": ["-y", "perfagent", "mcp"]
    }
  }
}
```

VS Code + GitHub Copilot (`.vscode/mcp.json`):

```json
{
  "servers": {
    "perfagent": {
      "command": "npx",
      "args": ["-y", "perfagent", "mcp"]
    }
  }
}
```

Cline (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "perfagent": {
      "command": "npx",
      "args": ["-y", "perfagent", "mcp"]
    }
  }
}
```

Zed (`settings.json`):

```json
{
  "context_servers": {
    "perfagent": {
      "command": {
        "path": "npx",
        "args": ["-y", "perfagent", "mcp"]
      }
    }
  }
}
```

ChatGPT (connectors, remote):

```bash
PERFAGENT_MCP_TOKEN=<long-random-token> npx perfagent mcp --http --port 4546
# ChatGPT needs a remote HTTPS endpoint: put this behind an HTTPS tunnel or proxy
# that sends "Authorization: Bearer $PERFAGENT_MCP_TOKEN", then add https://<tunnel>/mcp
```

Optional write tool, local only:

```bash
npx perfagent mcp --allow-writes
```

## Expert detail

- Transports: `stdio` (default, for editors and desktop apps) and Streamable HTTP (`--http --port 4546`, for ChatGPT connectors and teams). The HTTP transport serves `/mcp`, binds to `127.0.0.1` unless you pass `--host`, and needs `Authorization: Bearer <token>` on every request (set `PERFAGENT_MCP_TOKEN`, or copy the random token printed at start). The bearer token is the only authentication; OAuth is not implemented, so if your client requires OAuth, put a reverse proxy that does OAuth in front and have it forward the bearer token.
- Tools: `scan_url`, `scan_project`, `list_issues` (with chip and route filters), `explain_issue`, `get_file_context`, `suggest_fix`, `compare_runs`, `ai_report`, `open_dashboard`; `apply_fix_to_branch` only with `--allow-writes`. Resources: `perfagent://report/latest` and `perfagent://guide/<topic>`. All tools return JSON text.
- The snippets above are `MCP_CONFIGS` in `packages/server/src/routes/ai.ts`, served by `GET /api/ai/mcp-config?client=<id>`; "Copy config" copies exactly these. Config formats change, so each tool's own MCP documentation is linked below.
- `npx -y perfagent mcp` runs in the current project folder and reads `perfagent.config.ts` from there; add `--root path` to point elsewhere.
- The MCP server has no way to push, merge or deploy; writes, when enabled, go through the same fixer, path guard and `protected` globs as the dashboard.

## Walkthrough

```walkthrough
[
  { "screen": "settings", "area": "mcp-config", "title": "Pick your tool", "text": "Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot, Cline, Zed or ChatGPT." },
  { "screen": "settings", "area": "mcp-config", "title": "Copy config", "text": "One click copies the snippet in that tool's format, with the file name to paste it into." },
  { "screen": "terminal", "area": "command", "title": "Paste and restart", "text": "claude mcp add perfagent -- npx -y perfagent mcp" },
  { "screen": "assistant", "area": "prompt", "title": "Ask", "text": "Use PerfAgent to fix all performance issues on /checkout." },
  { "screen": "assistant", "area": "tool-calls", "title": "Tools", "text": "scan_project → list_issues → explain_issue, then changes on a branch for you to review." }
]
```

## Learn more

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Code: MCP](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Cursor: MCP](https://docs.cursor.com/context/model-context-protocol)
- [VS Code: MCP servers](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [OpenAI: Connectors in ChatGPT](https://platform.openai.com/docs/mcp)
