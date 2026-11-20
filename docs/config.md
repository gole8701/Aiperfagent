# Configuration

One file, `perfagent.config.ts` (also `.js`, `.mjs` or `.json`), validated by the zod schema in `packages/config/src/schema.ts`. `npx perfagent init` writes the template. Unknown keys are rejected.

Load order: defaults → config file → `PERFAGENT_*` environment variables → command-line flags. Environment variables map by path: `PERFAGENT_SERVER_PORT=5000` → `server.port`, `PERFAGENT_AI_PROVIDER=ollama` → `ai.provider`, `PERFAGENT_URLS=http://a,http://b` → `urls` (comma lists become arrays; `true`/`false`/numbers are coerced).

`perfagent.config.ts` needs Node 23+ or the `tsx` package on Node 20–22; otherwise use `.js`. Settings changed in the dashboard are stored as an overlay in `.perfagent/settings.json`; the config file is never rewritten.

```ts
import { defineConfig } from 'perfagent'

export default defineConfig({
  urls: ['http://localhost:3000'],
  root: '.',
  device: 'mobile',
  runs: 3,
  editor: 'auto',
  theme: 'system',
  budgets: { '/checkout': { lcp: 2500, inp: 200, js: '200kb' } },
  ai: { provider: 'none', sendCode: 'snippets', monthlyBudgetUsd: 20 },
  fix: { review: true, autoCommit: false, protected: [] },
})
```

## Every option

Generated from the schema (the same rows the Settings UI shows through `describeConfig()`).

### Project and scan

| Path            | Type                                                                                                                             | Default                                                                                | Description                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `root`          | string                                                                                                                           | `'.'`                                                                                  | Project folder to scan (resolved relative to the config file)                  |
| `urls`          | list of URLs                                                                                                                     | `[]`                                                                                   | Pages to measure                                                               |
| `device`        | `mobile` \| `desktop`                                                                                                            | `mobile`                                                                               | Device profile (Lighthouse-like throttling on mobile)                          |
| `browser`       | `chromium` \| `firefox` \| `webkit`                                                                                              | `chromium`                                                                             | Browser engine for scans; Chromium prefers the installed Chrome or Edge        |
| `runs`          | number 1–9                                                                                                                       | `3`                                                                                    | Runs per page; the median is reported                                          |
| `locations`     | list                                                                                                                             | `[]`                                                                                   | Regions to test from (hosted feature, planned)                                 |
| `editor`        | `auto` \| `vscode` \| `cursor` \| `windsurf` \| `zed` \| `sublime` \| `jetbrains` \| `vim` \| `neovim` \| `emacs` \| `notepad++` | `auto`                                                                                 | Editor for "Open in editor"                                                    |
| `theme`         | `system` \| `dark` \| `light` \| `high-contrast`                                                                                 | `system`                                                                               | Dashboard theme                                                                |
| `language`      | `en` \| `hi` \| `mr`                                                                                                             | `en`                                                                                   | Guide language                                                                 |
| `scan.include`  | list of globs                                                                                                                    | `['src/**', 'app/**', 'pages/**', 'components/**', 'lib/**', 'server/**']`             | Files the project scanner reads                                                |
| `scan.exclude`  | list of globs                                                                                                                    | `['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**']` | Files it skips                                                                 |
| `scan.maxFiles` | number ≥ 100                                                                                                                     | `20000`                                                                                | Upper bound on parsed files                                                    |
| `environments`  | map of `{ url }`                                                                                                                 | `{}`                                                                                   | Named environments, e.g. `{ staging: { url: 'https://staging.example.com' } }` |

### Rules and budgets

| Path                             | Type                  | Default  | Description                                                                                                                                   |
| -------------------------------- | --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules.packs`                    | `'auto'` or list      | `'auto'` | Rule packs; `auto` picks from `package.json` (`general`, `realtime`, `ai`, `agents` always; `react` for React/Next/Remix; `next` for Next.js) |
| `rules.disable`                  | list of rule ids      | `[]`     | Rule ids to switch off, e.g. `['general/too-many-requests']`                                                                                  |
| `budgets`                        | map of route → budget | `{}`     | Per-route limits that fail `perfagent ci`                                                                                                     |
| `budgets.<route>.lcp`            | number (ms)           | —        | Largest Contentful Paint limit                                                                                                                |
| `budgets.<route>.inp`            | number (ms)           | —        | Interaction to Next Paint limit                                                                                                               |
| `budgets.<route>.cls`            | number ≥ 0            | —        | Cumulative Layout Shift limit                                                                                                                 |
| `budgets.<route>.ttfb`           | number (ms)           | —        | Time to First Byte limit                                                                                                                      |
| `budgets.<route>.tbt`            | number (ms)           | —        | Total Blocking Time limit                                                                                                                     |
| `budgets.<route>.score`          | number 0–100          | —        | Minimum performance score                                                                                                                     |
| `budgets.<route>.js`             | size string           | —        | Maximum JavaScript per page, e.g. `'200kb'` or `'1.5mb'`                                                                                      |
| `budgets.<route>.aiFirstTokenMs` | number (ms)           | —        | AI first-token p95 limit                                                                                                                      |
| `budgets.<route>.aiCacheHitRate` | number 0–1            | —        | Minimum AI prompt-cache hit rate                                                                                                              |

### AI

| Path                  | Type                                                                                          | Default    | Description                                                            |
| --------------------- | --------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `ai.provider`         | `none` \| `ollama` \| `anthropic` \| `openai` \| `openai-compatible` \| `gemini` \| `browser` | `none`     | Which AI generates deep fixes                                          |
| `ai.model`            | string                                                                                        | `''`       | Model name; empty picks the provider default                           |
| `ai.baseUrl`          | URL                                                                                           | —          | Custom endpoint (OpenAI-compatible, Azure, company proxy)              |
| `ai.sendCode`         | `snippets` \| `files` \| `none`                                                               | `snippets` | How much code may be sent to the AI                                    |
| `ai.monthlyBudgetUsd` | number ≥ 0                                                                                    | `20`       | Stop using AI past this monthly spend                                  |
| `ai.maxPerFixUsd`     | number ≥ 0                                                                                    | `0.2`      | Stop a single fix past this cost                                       |
| `ai.redact`           | boolean                                                                                       | `true`     | Remove secrets before anything is sent                                 |
| `ai.auditLog`         | boolean                                                                                       | `true`     | Keep a local log of what was sent to which AI (`.perfagent/audit.log`) |
| `ai.logPrompts`       | boolean                                                                                       | `false`    | Store prompts and answers of measured AI calls (`watchAI`)             |
| `ai.budgetUsdPerDay`  | number ≥ 0                                                                                    | —          | Budget line on the AI cost chart                                       |

API keys are never in this file; the dashboard stores them in the OS keychain.

### Fix loop

| Path               | Type          | Default | Description                                                    |
| ------------------ | ------------- | ------- | -------------------------------------------------------------- |
| `fix.review`       | boolean       | `true`  | Show a diff for Accept / Edit / Skip                           |
| `fix.runTests`     | boolean       | `true`  | Run the project tests after each change                        |
| `fix.testCommand`  | string        | —       | Test command; default comes from `package.json`                |
| `fix.autoCommit`   | boolean       | `false` | Commit each accepted fix on the fix branch                     |
| `fix.maxRounds`    | number 1–50   | `10`    | Maximum fix → re-test rounds                                   |
| `fix.maxFiles`     | number ≥ 1    | `40`    | Maximum files changed per run                                  |
| `fix.maxCostUsd`   | number ≥ 0    | `5`     | Maximum AI spend per run                                       |
| `fix.protected`    | list of globs | `[]`    | Globs the AI may never edit, e.g. `['src/payments/**']`        |
| `fix.target.score` | number 0–100  | —       | Stop when the score reaches this                               |
| `fix.target.lcp`   | number (ms)   | —       | Accepted but not used yet; only `fix.target.score` stops a run |
| `fix.target.inp`   | number (ms)   | —       | Accepted but not used yet                                      |
| `fix.target.cls`   | number        | —       | Accepted but not used yet                                      |

### Live mode

| Path                      | Type        | Default | Description                             |
| ------------------------- | ----------- | ------- | --------------------------------------- |
| `live.sampleRate`         | number 0–1  | `0.1`   | Share of real-user sessions that report |
| `live.windowSeconds`      | number ≥ 10 | `60`    | Live chart window                       |
| `live.peakThresholdP95Ms` | number > 0  | `1500`  | p95 latency that counts as a peak       |

### Server

| Path          | Type              | Default | Description                                       |
| ------------- | ----------------- | ------- | ------------------------------------------------- |
| `server.port` | number 1024–65535 | `4545`  | Dashboard port (always bound to `127.0.0.1`)      |
| `server.open` | boolean           | `true`  | Open the browser on start (`--no-open` overrides) |

## Command-line flags

`--port`, `--root`, `--device`, `--runs`, `--url a,b`, `--label`, `--out`, `--json`, `--no-project`, `--no-open`, `--comment file.md` (ci), `--format` and `--out` (export), `--http`, `--port` (default 4546), `--host` (default `127.0.0.1`), `--allow-writes` (mcp), `--target` and `--port` (ai-proxy, default 4547), `--dev-origin` (dashboard development), `--force` (init). Flags win over environment variables and the file.
