# Guides

One Markdown file per guide topic. The same files power the in-app Guide (`/guide/<topic>`), the "i" buttons next to metrics, and the website docs. The server reads them through `packages/server/src/routes/guides.ts` (`GET /api/guides`, `GET /api/guides/:topic`).

## Catalogue (32 topics, fixed ids)

| Group            | Topics                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Get started      | `install` · `scan-project` · `test-url`                                                                   |
| Explore          | `globe` · `chips` · `deep-dive` · `flow-diagram` · `open-in-editor` · `charts`                            |
| Metrics          | `score` · `lcp` · `inp` · `cls` · `ttfb` · `tbt` · `bundle` · `memory` · `fcp`                            |
| Live & locations | `live` · `locations`                                                                                      |
| AI               | `measure-ai` · `ai-first-token` · `ai-cost` · `agent-readiness`                                           |
| Fix & connect    | `fix-with-ai` · `connect-ai` · `connect-mcp` · `fix-production-locally` · `retest-compare` · `budgets-ci` |
| Settings         | `security-local-mode` · `themes-export`                                                                   |

The ids are referenced by the dashboard (deep links) and by `guide` in `packages/core/src/metrics.ts`. Do not rename them.

## Front matter

Simple `key: value` lines between `---` fences (no YAML nesting, no quotes needed):

```
---
title: LCP
group: Metrics
summary: One sentence.
order: 11
tryIt: /charts/speed
metric: lcp
---
```

- `group`: one of Get started · Explore · Metrics · Live & locations · AI · Fix & connect · Settings
- `order`: 1–32 in catalogue order (`fcp` was added last, so it is 32)
- `tryIt`: dashboard route the "Try it" button opens
- `metric`: `MetricId` for metric guides (`lcp`, `aiFirstTokenMs`, `agentReadiness`…)

## Body headings, in this order

1. `## What it is` — one plain sentence first, then a short paragraph
2. `## Why it matters`
3. `## Use case`
4. `## How it helps your app`
5. `## Good, needs work, poor` — metric guides only; thresholds from `METRICS` as a table
6. `## How to do it in PerfAgent, step by step` — numbered; each step starts with the screen name in bold (`**Globe:**`)
7. `## Commands & config` — optional; fenced code blocks
8. `## Expert detail` — thresholds, formulas, routes, rule ids
9. `## Learn more` — links to official docs
10. `## हिन्दी` and `## मराठी` — optional translations of "What it is" and "Use case"

Writing rules: plain language first, technical names in parentheses; never only colour words; British/International English; short sentences; consistent terms (PerfAgent, `perfagent`, `perfagent.config.ts`, `perfagent-report.json`, `.perfagent/`). Say "planned" for anything not implemented.

## Check

```bash
pnpm docs:check   # node docs/guides/check.mjs
```

The check verifies the catalogue, front matter, heading order and step format. CI runs it.

## What the in-app guide adds

The dashboard builds each topic page from this Markdown plus `packages/web/src/features/guide/content.ts`: the one-line explanation, the everyday analogy, the "How to check it" steps (each pointing at a control in a real screenshot), the copyable test steps and the common causes. The animated diagrams live in `packages/web/src/features/guide/diagrams/`. Everything else in the Markdown appears under "More detail".

Screenshots are real captures of the dashboard on the demo shop:

```bash
# 1. make the demo shop the latest report
cd fixtures/demo-shop && node ../../packages/cli/dist/bin.js scan http://localhost:3000 --runs 1
# 2. capture (from packages/collectors so playwright-core resolves)
cd packages/collectors && node ../../docs/guides/capture-shots.mjs "<dashboard url with token>"
```

It writes `packages/web/public/guide/*.webp` and the control positions in `shots.ts`. Check every image by eye before committing: no absolute paths, user names, emails, tokens or third-party sites.
