# Architecture

PerfAgent is a pnpm monorepo of small TypeScript packages. One npm package, `perfagent`, is published; it bundles the others and ships the pre-built dashboard and the guides.

## Packages

| Package                      | Layer | What it does                                                                                                                                                                                                          |
| ---------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@perfagent/core`            | 0     | Pure logic, no I/O: types (`Report`, `Issue`, `PageResult`, `TreeNode`), `METRICS` and thresholds, `AREAS` and chips, score, compare, root cause chain, plain-language summary                                        |
| `@perfagent/config`          | 1     | The one zod schema for `perfagent.config.ts`, defaults, loader (file → `PERFAGENT_*` env → CLI flags), `describeConfig()` for docs and the Settings UI, `CONFIG_TEMPLATE`                                             |
| `@perfagent/report-schema`   | 1     | zod schema for `perfagent-report.json`, `parseReport`, `MAX_IMPORT_BYTES` (60 MB)                                                                                                                                     |
| `@perfagent/security`        | 1     | token, origin check, CSP headers, path guard, redaction, SSRF guard, mode detection                                                                                                                                   |
| `@perfagent/collectors`      | 3     | Playwright + Chrome DevTools Protocol: `launchBrowser` (prefers the installed Chrome), `measurePage` (median of N runs, filmstrip, coverage, long tasks, LoAF, layout shifts), `collectReadiness`, `startLiveSession` |
| `@perfagent/importers`       | 3     | Registry of importers: PerfAgent JSON, PageSpeed, Lighthouse, HAR, Chrome trace, bundle stats, OpenTelemetry (incl. GenAI), web-vitals, CSV, PDF, Excel, Word, pasted text                                            |
| `@perfagent/scanner`         | 2     | Project tree: files → imports → components → hooks → functions → JSX elements; framework detection from `package.json`                                                                                                |
| `@perfagent/rules`           | 3     | Rule engine + packs: `general`, `react`, `next`, `realtime`, `ai`, `agents`; turns findings into `Issue`s with chain, gain and fix                                                                                    |
| `@perfagent/engine`          | 4     | The pipeline (`runScan`, `retestIssue`), `ReportStore` (`.perfagent/`), budgets, git info, and the `AiService` / `FixService` contracts                                                                               |
| `@perfagent/server`          | 5     | Local HTTP + WebSocket server, routes, editor launch, export, jobs                                                                                                                                                    |
| `@perfagent/ai`              | 5     | Providers (Anthropic, OpenAI, OpenAI-compatible, Gemini, Ollama; in-browser runs in the dashboard), key storage, `watchAI()` wrapper, local measuring proxy                                                           |
| `@perfagent/fixer`           | 5     | Fix loop: proposals, review, apply on a new branch, tests, re-test, undo                                                                                                                                              |
| `@perfagent/mcp`             | 5     | MCP server (stdio and Streamable HTTP) exposing read-only tools, optional write tool                                                                                                                                  |
| `@perfagent/agent`           | —     | Real-user browser snippet (`perfagent.js`, under 8 KB, no dependencies)                                                                                                                                               |
| `@perfagent/web`             | —     | The React + Vite dashboard; talks to the server only through `src/api`                                                                                                                                                |
| `perfagent` (`packages/cli`) | 6     | The binary: `init`, start, `scan`, `ci`, `import`, `export`, `compare`, `mcp`, `ai-proxy`; the programmatic API and `perfagent/ai`                                                                                    |

`apps/site` is the public static website; `fixtures/demo-shop` is the sample project with 12 seeded problems; `fixtures/reports` holds sample inputs for importers.

## Dependency direction

Enforced by the `perfagent/layer-direction` rule in `eslint.config.mjs`. A package may import only packages in a lower layer:

```
core · agent
  ← config · report-schema · security
      ← scanner · web
          ← collectors · importers · rules
              ← engine
                  ← server · ai · fixer · mcp
                      ← cli
```

`web` sits low on purpose: it may import `core` and `report-schema` (types and schema) but no Node package, and talks to `server` only over HTTP/WebSocket through `packages/web/src/api`. `agent` sits with `core`, so it cannot import anything. Import cycles are a lint error (`import-x/no-cycle`), and importing a package's `dist/` is forbidden.

## Data flow: scan → rules → report → dashboard

```
perfagent.config.ts ──► loadConfig ──► PerfAgentConfig
                                          │
   runScan(request, { config })           ▼
   ├─ scanProject(root)         → ProjectScan { files, tree, framework, packages, assets }
   ├─ launchBrowser → measurePage(url) × runs → PageResult (median metrics, requests, long tasks, shifts, filmstrip, coverage, features)
   ├─ packsFor(framework) → detectIssues({ scan, pages, packs }) → Issue[] (chain, gain, fix, prevent, docs)
   ├─ attachIssues(tree, issues) · gitInfo(root)
   └─ redact(report) ──► ReportStore.save ──► .perfagent/reports/<id>.json + history.json
                                          │
   server routes (/api/*) ◄── token + origin check ◄── dashboard (React) ◄── /ws progress + live ticks
```

Progress is reported in phases `project` → `browser` → `rules` → `done` and streamed over the WebSocket as `scan:progress`.

## The report (`perfagent-report.json`)

Exactly the `Report` type in `packages/core/src/types.ts`, validated by `packages/report-schema` on every read and import:

- `schemaVersion: 1`, `tool { name, version }`, `id`, `createdAt`, `label?`
- `environment { name, url?, device, browser, region?, mode: local|deployed|imported }`
- `build? { commit, branch, framework, frameworkVersion, dependencies }`
- `pages[]`: `url`, `route`, `device`, `runs`, `metrics[] { id, value, unit, samples?, p75?, sampleCount? }`, `phases[]`, `requests[]`, `longTasks[]`, `layoutShifts[]`, `filmstrip[]`, `lcpElement?`, `features?`, `coverage?`
- `issues[]`: `id`, `ruleId`, `title`, `plain`, `severity`, `metrics[]`, `areas[]`, `route?`, `location? { file, line, column?, symbol?, bundled? }`, `chain[] { kind, label, detail?, location? }`, `why`, `frameworkRule?`, `gain { metric, from, to, scoreDelta, note? }`, `fix { steps[], changes[] { file, before, after }, automatic }`, `prevent? { route, metric, max }`, `docs[]`, `status`, `confidence`, `verified?`
- `tree?` (`TreeNode`: `id`, `name`, `kind`, `path`, `line?`, `tag`, `sizeBytes?`, `imports?`, `issueIds[]`, `counts`, `children[]`)
- `ai? { calls[], callSites[], models[], budgetUsdPerDay? }`, `live? LiveStats`, `readiness?`, `detected?[]` (values read from documents, with confidence)

Never included: cookies, auth headers, tokens, form values, personal data. Redaction runs at collection and again at import.

## Environment modes

`detectMode` (`packages/security/src/mode.ts`) decides per server start. Local mode needs all of: bound to a loopback address, the project is a git repository, `NODE_ENV` is not `production` (or `PERFAGENT_FORCE_LOCAL=true`), and not the static build. Otherwise the mode is `deployed` (suggest-only) and the reasons are printed and shown in the dashboard.

Write routes (`/api/editor/*`, `/api/files/snippet`, `/api/fix/*`) are registered only in local mode, so a deployed or static build has no code path that writes files. The static website build passes `staticBuild: true`, which additionally disables scans and live mode (`NOT_LOCAL_MODE`).

## Where data lives

Everything is in `<root>/.perfagent/` (git-ignored by `perfagent init`):

| File                | Content                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `reports/<id>.json` | One report per scan, import or live session                                                 |
| `history.json`      | `{ reportId, at, score, label?, annotation? }[]`, last 200                                  |
| `settings.json`     | Overlay of settings changed in the dashboard; `perfagent.config.ts` is never rewritten      |
| `audit.log`         | One line per AI call and fix run: what was sent to which provider, which branch was created |
| `ai-samples.jsonl`  | AI calls measured by `watchAI()`, `perfagent ai-proxy` or the agent snippet                 |
| `rum.jsonl`         | Real-user agent events received at `/agent/collect`                                         |

API keys are not in this folder; they are in the OS keychain (or a 0600 file in `~/.perfagent` on Windows). Nothing in `.perfagent/` leaves the machine unless you export it.

## Dashboard routes (`packages/web`)

`/` globe · `/issues/:id` globe with deep dive · `/flow` and `/flow/*path` · `/charts/:tab` (overview, speed, code, network, live, ai, users, business) · `/compare` and `/compare/:a/:b` · `/guide` and `/guide/:topic` · `/live` · `/settings/ai`, `/settings/fix`, `/settings/display`.

## Tooling

TypeScript strict with `noUncheckedIndexedAccess`; ESLint (typescript-eslint strict + stylistic, import order, no cycles, layer rule); Prettier; Vitest for unit and integration tests (`packages/*/src/**/*.test.ts`, `packages/*/test/**`); Playwright for the dashboard e2e; `scripts/perf-budget.mjs` for PerfAgent's own budgets; `docs/guides/check.mjs` for the guides.
