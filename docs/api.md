# Server API

The local server (`packages/server`) listens on `127.0.0.1:<server.port>` (default 4545). Every `/api/*` route needs the session token; every request must pass the Host/Origin check. Handlers return JSON; errors are `{ error, code, hint? }`.

## Token and origin rules

- A fresh 32-byte token is created on every start and printed in the dashboard URL (`?token=…`).
- Send it as `Authorization: Bearer <token>`, as `?token=<token>` in the query, or as the `perfagent_token` cookie. Missing or wrong → `401 UNAUTHORIZED`.
- `Host` must be `127.0.0.1`, `localhost` or `[::1]` on the server port. `Origin`, when present, must be the same address and port (plus `--dev-origin` during dashboard development). `Origin: null` is rejected. A request with no `Origin` but `Sec-Fetch-Site: cross-site` is rejected. Any failure → `403 ORIGIN_REJECTED`.
- Every response carries the security headers from `packages/security/src/csp.ts` (strict CSP, `nosniff`, `X-Frame-Options: DENY`, `no-referrer`, COOP/CORP, `Cache-Control: no-store`).
- Body limits: 5 MB for JSON bodies, 64 MB for raw uploads (`413 IMPORT_TOO_LARGE`).
- Error codes → status: `NOT_FOUND` 404, `UNAUTHORIZED` 401, `ORIGIN_REJECTED` 403, `PATH_OUTSIDE_ROOT` 403, `NOT_LOCAL_MODE` 403, `IMPORT_TOO_LARGE` 413, `BROWSER_MISSING` 503, `AI_NOT_CONFIGURED` 409, other `PerfAgentError` codes 400, unexpected errors 500.

Paths that are not `/api/*` serve the built dashboard; unknown paths fall back to `index.html` for client-side routing.

## Status

| Method and route  | Purpose                        | Request | Response                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/status` | Version, mode and capabilities | —       | `{ version, mode, modeReasons[], project { root, name, framework, frameworkVersion, commit, branch }, config { urls, device, runs, editor, theme, language, aiProvider, environments }, editors, latestReportId, capabilities { scanProject, openEditor, applyFixes, ai, live }, options: OptionDoc[] }` |

## Scans and jobs

| Method and route               | Purpose                       | Request                                                         | Response                                                                 |
| ------------------------------ | ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/scans`              | Start a scan job              | `{ urls?, project?, device?, runs?, label?, environmentName? }` | `{ jobId }`; progress on `/ws`                                           |
| `GET /api/jobs/:id`            | Job state                     | —                                                               | `{ id, kind, status, progress?, error?, reportId? }`                     |
| `GET /api/scans`               | History                       | —                                                               | `HistoryPoint[]` `{ reportId, at, score, label?, annotation? }`          |
| `GET /api/scans/latest`        | Latest report                 | —                                                               | `Report` (404 when none)                                                 |
| `GET /api/scans/:id`           | One report                    | —                                                               | `Report`                                                                 |
| `DELETE /api/scans/:id`        | Delete a report               | —                                                               | `{ ok: true }`                                                           |
| `POST /api/scans/:id/annotate` | Note on the trend chart       | `{ annotation }` (≤ 200 chars)                                  | `{ ok: true }`                                                           |
| `POST /api/scans/:id/retest`   | Re-measure one problem's page | `{ issueId }`                                                   | `{ jobId }`; the issue gets `verified { metric, predicted, actual, at }` |

`POST /api/scans` is refused with `NOT_LOCAL_MODE` in the static build. In deployed mode `project` is forced to `false` and loopback URLs are refused.

## Issues, tree, summary

| Method and route              | Purpose                                 | Request                                    | Response                                                            |
| ----------------------------- | --------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `GET /api/issues`             | Issues for chips and the list           | `?reportId=` (default latest) `&filter=all | metric:<id>                                                         | area:<id>` `&route=` | `{ reportId, issues: Issue[], chips: { metrics, areas, total } }` |
| `GET /api/issues/:id`         | One issue                               | `?reportId=`                               | `Issue`                                                             |
| `POST /api/issues/:id/status` | Mark fixed / ignored / open             | `{ status }` + `?reportId=`                | `Issue`                                                             |
| `GET /api/tree`               | Project tree for flow diagram and globe | `?reportId=`                               | `TreeNode` (404 when the report has no tree)                        |
| `GET /api/summary`            | "In simple words"                       | `?reportId=&route=`                        | `{ headline, sentences[], topIssues[], scoreNow, scoreAfterFixes }` |

## Compare

| Method and route    | Purpose             | Request                                                                                                                                                                                   | Response                                                                                        |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `POST /api/compare` | Compare 2–5 sources | `{ sources: CompareSource[], routeA?, routeB? }` where a source is `{ kind: 'report', reportId }`, `{ kind: 'url', url }`, `{ kind: 'text', text, filename? }` or `{ kind: 'link', url }` | `{ comparison: Comparison, extra: Comparison[], reports: [{ id, label, createdAt, pages[] }] }` |

`url` sources run a fresh 3-run scan (not in the static build). `link` sources accept a dashboard link with `?report=<id>` or an exported `.json` link (fetched with a 15 s timeout).

## Import, export, budgets

| Method and route               | Purpose                                | Request                                                                                    | Response                                                      |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | --- | ----- | ------------------------------------------- |
| `POST /api/import`             | Upload any supported file              | Raw body; `X-Filename` header or `?filename=`; `?format=` hint; `?save=false` to not store | `{ reportId, format, exact, detected[], warnings[], report }` |
| `POST /api/import/text`        | Pasted text or JSON                    | `{ text, filename? }`                                                                      | same as above                                                 |
| `POST /api/import/:id/correct` | Correct low-confidence detected values | `{ values: [{ metric, value, route? }] }`                                                  | `Report`                                                      |
| `GET /api/export/:id`          | Download                               | `?format=json                                                                              | csv                                                           | md  | html` | File with `Content-Disposition: attachment` |
| `GET /api/budgets/:id`         | Check config budgets against a report  | —                                                                                          | `{ results: BudgetResult[], markdown, passed }`               |

## Settings and guides

| Method and route         | Purpose                                     | Request                                                                                                                            | Response                                                                                   |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /api/settings`      | Config (without `root`) and the schema rows | —                                                                                                                                  | `{ config, schema: OptionDoc[], file }`                                                    |
| `PUT /api/settings`      | Change settings                             | Partial config; only `device`, `runs`, `editor`, `theme`, `language`, `ai`, `fix`, `live`, `budgets`, `rules`, `urls` are accepted | `{ config }`; stored as an overlay in `.perfagent/settings.json`                           |
| `GET /api/guides`        | Guide catalogue                             | —                                                                                                                                  | `GuideMeta[]` `{ topic, title, group, summary, order, tryIt?, metric? }` sorted by `order` |
| `GET /api/guides/:topic` | One guide                                   | —                                                                                                                                  | `GuideMeta & { body }` (Markdown)                                                          |

## AI

| Method and route                | Purpose                                                                              | Request                                                                | Response                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ | -------- | ------- | ----- | --- | ----------------------- | -------------------------- |
| `GET /api/ai/providers`         | Provider statuses                                                                    | —                                                                      | `{ providers: ProviderStatus[], active, usage { monthUsd, calls, lastAt? }, config }` |
| `POST /api/ai/test`             | Test a connection                                                                    | `{ provider, model?, baseUrl? }`                                       | `{ ok, message, latencyMs }`                                                          |
| `POST /api/ai/keys`             | Store a key in the OS keychain                                                       | `{ provider, key }` (≥ 8 chars)                                        | `{ ok: true }`; audit line written                                                    |
| `DELETE /api/ai/keys/:provider` | Remove a key                                                                         | —                                                                      | `{ ok: true }`                                                                        |
| `POST /api/ai/openrouter`       | Finish "Connect with OpenRouter"                                                     | `{ code, verifier }`                                                   | `{ connected: true }`; key stored, audit line written                                 |
| `POST /api/ai/pull`             | Download a free Ollama model                                                         | `{ model }`                                                            | `{ started: true }`; progress as `ai:pull` WebSocket messages                         |
| `POST /api/ai/mcp-connect`      | One-click add PerfAgent to Claude Code, Claude Desktop or Windsurf (local mode only) | `{ client }`                                                           | `{ message }`                                                                         |
| `POST /api/ai/explain`          | Explain one issue                                                                    | `{ reportId?, issueId }`                                               | `{ text }`                                                                            |
| `POST /api/ai/summary`          | Summarise a report                                                                   | `{ reportId? }`                                                        | `{ text }`                                                                            |
| `POST /api/ai/suggest`          | Proposed changes as text, applies nothing                                            | `{ reportId?, issueIds[] }`                                            | `{ changes: ProposedChange[] }`                                                       |
| `GET /api/ai/report`            | AI calls measured by `watchAI`, the proxy or the agent                               | —                                                                      | Per-model first-token p50/p95, cost and error rate                                    |
| `POST /api/ai/compare-models`   | Ask the same questions to several models                                             | `{ questions[] (1–5 used), models: [{ provider, model }] (2–6 used) }` | `{ rows: ModelComparison[] }`                                                         |
| `GET /api/ai/mcp-config`        | MCP client snippets                                                                  | `?client=claude-code                                                   | claude-desktop                                                                        | cursor | windsurf | copilot | cline | zed | chatgpt` (omit for all) | `{ label, file, snippet }` |

Code context is gathered only in local mode, following `ai.sendCode`, and redacted. Without an AI service the routes answer `409 AI_NOT_CONFIGURED`.

## Live

| Method and route       | Purpose                                                | Request                            | Response                                   |
| ---------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------------------ |
| `POST /api/live/start` | Open the page in a controlled browser and stream ticks | `{ url }` (SSRF-checked)           | `{ started, url }`                         |
| `POST /api/live/stop`  | Stop and save as a report                              | —                                  | `{ stopped, reportId?, stats: LiveStats }` |
| `GET /api/live/status` | Is a session running                                   | —                                  | `{ running, url? }`                        |
| `POST /agent/collect`  | Real-user agent batches (`sendBeacon`)                 | `{ events: [] }` (≤ 500 per batch) | `{ received }`                             |

Live start/stop are refused in the static build. `/agent/collect` is outside `/api/*`: it takes no token, accepts only `Origin`s from `config.urls` or `config.environments` (`403 ORIGIN_REJECTED` otherwise) and bodies up to 256 KB.

## Local mode only

These routes are registered only when the mode is `local` and the build is not static; elsewhere they do not exist (404).

| Method and route                | Purpose                         | Request                                                                     | Response                                                                 |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------- | ------------------------ | ----------------- | -------- |
| `POST /api/editor/open`         | Open file:line in the editor    | `{ file, line?, column?, editor? }`                                         | `{ opened, absolute, message, fallbackUrl?, hint? }`                     |
| `GET /api/editor/link`          | URL-scheme fallback             | `?file=&line=&column=&editor=`                                              | `{ url?, absolute }`                                                     |
| `GET /api/files/snippet`        | Source window for the deep dive | `?file=&line=&radius=` (≤ 60)                                               | `{ file, startLine, lines[], totalLines }` (redacted)                    |
| `POST /api/fix/runs`            | Start a fix run                 | `{ reportId, scope, target?, review? }`; scope `{ kind: 'issue', issueIds } | { kind: 'file', file }                                                   | { kind: 'chip', chip } | { kind: 'route', route } | { kind: 'site' }` | `FixRun` |
| `GET /api/fix/runs`             | All runs                        | —                                                                           | `FixRun[]`                                                               |
| `GET /api/fix/runs/:id`         | One run                         | —                                                                           | `FixRun { id, request, branch, status, events[], pending[], startedAt }` |
| `POST /api/fix/runs/:id/accept` | Accept proposals                | `{ changeIds[], edits? }`                                                   | `FixRun`                                                                 |
| `POST /api/fix/runs/:id/skip`   | Skip proposals                  | `{ changeIds[] }`                                                           | `FixRun`                                                                 |
| `POST /api/fix/runs/:id/undo`   | Restore every file of the run   | —                                                                           | `FixRun`                                                                 |

All file paths go through the path guard (real path inside the project root; `.env*`, keys, `.git`, `node_modules`, `.perfagent` refused with `403 PATH_OUTSIDE_ROOT`).

## WebSocket `/ws`

Upgrade requests need the same token and origin check (`401` otherwise). On connect the server sends `{ type: 'hello', mode }`. Messages are broadcast to every connected dashboard tab:

| Message         | Fields                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----- | ----------------------------------- |
| `scan:progress` | `jobId`, `phase` (`project                                                                                                                                                                          | browser | rules | done`), `message`, `fraction` (0–1) |
| `scan:done`     | `jobId`, `reportId`                                                                                                                                                                                 |
| `scan:error`    | `jobId`, `message`                                                                                                                                                                                  |
| `live:tick`     | `tick` (`LiveTick`: `at`, `requestsPerSec`, `p95LatencyMs`, `wsMessagesPerSec`, `wsBytesPerSec`, `wsReconnects`, `wsRttMs`, `memoryMb`, `slowest[]`, `peak?`; agent events carry `source: 'agent'`) |
| `live:stopped`  | `reportId?`                                                                                                                                                                                         |
| `fix:event`     | `runId`, `event` (`round`, `proposal`, `applied`, `check`, `retest`, `rolled-back`, `done`, `error`)                                                                                                |

The dashboard only receives; it never sends commands over the socket.

## Static files

`/agent/perfagent.js` serves the real-user agent snippet when built. Static assets are served with `Cache-Control: public, max-age=31536000, immutable`; HTML with `no-store`.
