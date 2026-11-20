# PerfAgent

**PerfAgent finds, explains and fixes web and AI performance problems — down to the exact file and line.**

- It measures your pages in a real browser (Playwright + Chrome DevTools Protocol) and reads your source code, then connects the two: "your main picture loads late" becomes `src/components/HeroBanner.tsx:5`, with the cause, the fix and the expected gain.
- It explains everything twice: in plain words for anyone on the team, and in technical terms for the person fixing it. Thirty-one built-in guides cover every metric and feature.
- It is local, read-only by default and uses your own AI if you want AI at all. Nothing is uploaded, nothing phones home.

> Status: early, before the first release. The scan engine, rules, server, CLI, report format, dashboard, importers, AI providers, fixer and MCP server are in this repository. Anything not finished is marked **planned** below.

## 60-second start

```bash
npm i -D perfagent
npx perfagent init        # creates perfagent.config.ts, git-ignores .perfagent/
npx perfagent             # → Dashboard: http://127.0.0.1:4545/?token=…
```

Needs Node.js 22+ and Google Chrome or Edge on the machine (or `npx playwright install chromium`).

## What you get

- **3D globe** of your project: folders as rings, files as points, problems glowing by severity and gain. Click a point to fly to the cause.
- **Chips** that filter by metric (LCP, INP, CLS, TTFB, TBT, FCP, AI first token, AI cost, Agents) or by area (images, bundle, re-renders, API, WebSocket and 16 more), consistently across globe, list and charts.
- **Deep dive** per problem: file:line with _Open in editor_ (VS Code, Cursor, Windsurf, Zed, Sublime, JetBrains, Vim, Neovim, Emacs, Notepad++), root cause chain (metric → element or request → component → code), why it happens, before/after fix, estimated gain, a budget to prevent it, docs links, re-test and mark fixed.
- **Flow diagram** of the project from root to any depth, left to right, with problem counts on every branch.
- **Charts in plain language**: eight tabs, every chart titled with a question and ending with one sentence of meaning; "In simple words" generated from the data, no AI needed.
- **Compare anything**: before/after, page vs page, release vs release; sources can be saved scans, URLs, PerfAgent JSON, Lighthouse or PageSpeed JSON, a dashboard link, HAR, Chrome traces, bundle stats, OpenTelemetry, web-vitals exports, CSV, PDF, Excel, Word or pasted text with a "detected values" check.
- **A guide for every feature**: written steps naming the screen, an animated walkthrough over the real UI, beginner/expert, English, Hindi and Marathi.
- **Live mode**: requests, latency, WebSocket messages, reconnects and memory every second from a browser PerfAgent controls, or from real users with a tiny agent snippet.
- **AI performance** in the same dashboard: wrap your client with `watchAI()` to record first token, tokens, cost, cache hits, errors and agent steps; 15 static AI rules find problems without any measurement.
- **Bring your own AI**: Anthropic, OpenAI, OpenAI-compatible or Gemini with your key in the OS keychain, a company endpoint, or free local Ollama.
- **MCP server** for Claude Code, Claude Desktop, Cursor, Windsurf, VS Code Copilot, Cline, Zed and (over Streamable HTTP with a bearer token) ChatGPT: `npx perfagent mcp`.
- **Fix loop**: your AI proposes, you review, changes land on a new branch, your tests run, the page is re-tested, and _Undo_ restores everything.
- **Budgets in CI**: limits per route in the config; `npx perfagent ci` fails the build and writes a pull-request comment.

## How it is useful

**A developer** runs `npx perfagent` on a React app, clicks the brightest point on the globe, sees `HeroBanner.tsx:5` with `loading="lazy"` on the hero image, presses _Open in editor_, removes the attribute, presses _Re-test_ and watches LCP drop.

**A founder who does not code** opens Charts, reads _"Usable, but 16 things slow it down. Fixing the top 3 problems gives about +20 points. Start with: Your main picture loads late."_ and knows what to ask for in the next sprint.

**A team with a production problem** scans the production URL from the dashboard (suggest-only there), exports `perfagent-report.json`, imports it on a developer's machine where the globe shows the production problems on local files, fixes them on a branch, re-tests, deploys, and compares the next production scan with the previous one.

**An AI-assistant user** adds `claude mcp add perfagent -- npx -y perfagent mcp` and asks _"Use PerfAgent to fix the LCP problems on /checkout"_; the assistant calls `scan_project`, `list_issues` and `explain_issue`, writes the changes, and PerfAgent re-tests.

## Safety promises

- Runs on `127.0.0.1` only, with a fresh secret token every start; requests from other websites are rejected.
- Read-only by default. Code changes happen only in local mode (loopback, git repository, not production), on a new branch `perfagent/fix-<date>`, after your review. Write routes do not exist in deployed or hosted builds.
- Never pushes, merges, force-pushes, rebases, tags or deploys. You do.
- Your AI keys stay in your OS keychain (a private file on Windows) and go only to the provider they belong to. Your tokens, your bill. PerfAgent has no keys and no AI server; the optional `ai-proxy` only runs on your machine to measure your own app's calls.
- Secrets are redacted before storage, display, export or AI. Imports are size-limited, schema-validated, never executed, rendered as text.
- No telemetry.

Details and the threat model: [SECURITY.md](SECURITY.md), [security/THREAT_MODEL.md](security/THREAT_MODEL.md), [docs/security.md](docs/security.md).

## Demo

`fixtures/demo-shop` is a small React + Vite shop with 12 deliberate problems. Start it and scan it:

```bash
pnpm install && pnpm build
pnpm demo                                   # serves http://localhost:3000
node packages/cli/dist/bin.js scan --root fixtures/demo-shop http://localhost:3000
```

The seeded problems and what PerfAgent reports for them (from `fixtures/reports/demo-shop-before.json`, mobile profile, score **54**, LCP **12.4 s**, 1.9 MB of JavaScript, 70 requests):

| #   | Seeded problem                                                 | Rule                                                                                            | Reported at                                       |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Hero image lazy-loaded                                         | `general/lcp-image-lazy` (critical, LCP 12.4 s → est. 6.8 s, **+11 points**)                    | `src/components/HeroBanner.tsx:5`                 |
| 2   | CartSummary re-renders on every keystroke (whole cart context) | `react/context-rerender` (critical); also surfaced by `react/eager-conditional-import` (~63 KB) | `src/components/CartSummary.tsx`, `src/App.tsx:3` |
| 3   | Whole `date-fns` imported for two functions                    | `react/namespace-import` (**78 KB**)                                                            | `src/lib/dates.ts:2`                              |
| 4   | WebSocket reconnect storm                                      | `realtime/reconnect-no-backoff` (critical)                                                      | `src/lib/socket.ts:11`                            |
| 5   | RAG: embed, search and order lookup awaited one after another  | `ai/sequential-await` (first token 2.4 s → est. 0.9 s)                                          | `src/server/rag.ts:28`                            |
| 5b  | 9,800-token system prompt sent uncached every call             | `ai/no-prompt-cache` (cost −50–60 %)                                                            | `src/server/rag.ts:28`                            |
| 6   | Google Tag Manager loaded synchronously                        | `general/blocking-third-party` (critical, +8 points)                                            | `index.html:8`                                    |
| 7   | Polling interval never cleared                                 | `react/effect-without-cleanup` (critical)                                                       | `src/components/LiveStock.tsx:8`                  |
| 8   | `@font-face` without `font-display`                            | `general/font-display-missing`                                                                  | `src/styles/fonts.css:2`                          |
| 9   | Unused legacy stylesheet                                       | `general/unused-css` (**234 KB** loaded on every page)                                          | `src/styles/legacy.css:1`                         |
| 10  | `/api/products` without `Cache-Control`                        | `general/uncached-api`                                                                          | `src/server/api/products.ts:22`                   |
| 11  | Product image without width/height                             | `general/image-missing-dimensions` (CLS 0.097 → est. 0.037)                                     | `src/components/ProductCard.tsx:10`               |
| 12  | Chat widget imported eagerly, shown on demand                  | `react/eager-conditional-import` (**~81 KB**)                                                   | `src/components/Header.tsx:3`                     |

The same scan also reports `general/big-javascript`, `general/no-compression` and an eager `ProductGrid` import: 17 issues in total. Agent readiness is 85 (no JSON-LD).

## CLI

```
perfagent                 start the local dashboard (default)
perfagent init            create perfagent.config.ts
perfagent scan [url…]     measure pages + scan the project, print problems
perfagent ci              scan and fail when a budget is over its limit (--comment file.md for a PR comment)
perfagent import <file>   import Lighthouse / HAR / PDF / Excel / Word / CSV / PerfAgent JSON
perfagent export [id]     export a report (--format json|csv|md|html --out file)
perfagent compare <a> <b> compare two reports (ids or files)
perfagent mcp             run as an MCP server for Claude Code, Cursor, Copilot… (--http --port 4546 --host 127.0.0.1 for remote, --allow-writes for the fix tool)
perfagent ai-proxy        measure your app's AI calls with no code change (--target https://api.openai.com --port 4547)

Options: --port 4545  --root .  --device mobile|desktop  --runs 3  --no-project  --json  --no-open
```

## Config

`npx perfagent init` writes this; every option is documented in [docs/config.md](docs/config.md).

```ts
import { defineConfig } from 'perfagent'

export default defineConfig({
  // Pages to measure. Leave empty to paste URLs in the dashboard.
  urls: ['http://localhost:3000'],
  root: '.',
  device: 'mobile',
  runs: 3,
  editor: 'auto',
  theme: 'system',
  budgets: {
    // '/checkout': { lcp: 2500, inp: 200, js: '200kb' },
  },
  ai: {
    // 'ollama' is free and runs on your machine. Keys for other providers are
    // stored in your OS keychain through the dashboard, never in this file.
    provider: 'none',
    sendCode: 'snippets',
    monthlyBudgetUsd: 20,
  },
  fix: {
    review: true,
    autoCommit: false,
    protected: [],
  },
})
```

## MCP in one line

```bash
claude mcp add perfagent -- npx -y perfagent mcp
```

Other clients (Cursor, Windsurf, Copilot, Cline, Zed, Claude Desktop, ChatGPT): [docs/mcp.md](docs/mcp.md).

## Measuring AI in your app

```ts
import Anthropic from '@anthropic-ai/sdk'
import { watchAI } from 'perfagent/ai'

const client = watchAI(new Anthropic()) // same client, now measured: first token, tokens, cost, cache, errors
```

Prompts and answers are not stored unless you set `ai.logPrompts: true`.

## Screenshots

Captured from the real dashboard; see [docs/images/README.md](docs/images/README.md) for how. Not committed yet.

| Globe                   | Deep dive                   | Charts                   |
| ----------------------- | --------------------------- | ------------------------ |
| `docs/images/globe.png` | `docs/images/deep-dive.png` | `docs/images/charts.png` |

## Project structure

```
packages/   core · config · report-schema · security · collectors · importers · scanner · rules · engine · server · ai · fixer · mcp · agent · web · cli
apps/site   public static website (landing, docs, PageSpeed quick test, demo dashboard)
docs/       architecture, api, config, rules, import-formats, mcp, security, faq, guides/ (31 topics)
fixtures/   demo-shop (12 seeded problems) · reports (sample inputs)
security/   THREAT_MODEL.md · CHECKLIST.md
scripts/    perf-budget.mjs
```

Dependency direction is enforced by lint: `core` ← `config/report-schema/security` ← `scanner` ← `collectors/importers/rules` ← `engine` ← `server/ai/fixer/mcp` ← `cli`. See [docs/architecture.md](docs/architecture.md).

## Development

```bash
pnpm install
pnpm build          # all packages
pnpm lint && pnpm typecheck && pnpm test
pnpm e2e            # dashboard, Playwright
pnpm perf-budget    # PerfAgent's own budgets: CLI cold start < 300 ms, dashboard JS ≤ 250 KB gzip
pnpm docs:check     # guide format
pnpm dev            # dashboard dev server
```

Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Roadmap

- First release: polish and publish what is in this repository (dashboard, importers, AI providers, fix loop, MCP server over stdio and HTTP).
- Then: tests from other locations (hosted), OAuth login for MCP over HTTP, Vue/Nuxt, Angular and Svelte rule packs, more charts from analytics connectors, a VS Code extension, a regression finder (bisect by performance).
- Hosted team features (history, sharing, real-user collection) are planned in a separate repository under a different licence.

## Licence

MIT. Open core: everything in this repository is and stays MIT; paid hosted features, if they come, live elsewhere.

## Credits

Built on Playwright, the Chrome DevTools Protocol, web-vitals, zod, React, Vite, Three.js, React Flow, elkjs, Apache ECharts, the Model Context Protocol SDK, and the web.dev, MDN, react.dev and nextjs.org documentation the guides link to.
