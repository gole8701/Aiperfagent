# Guides

One Markdown file per guide topic. The same files power the in-app Guide (`/guide/<topic>`), the "i" buttons next to metrics, and the website docs. The server reads them through `packages/server/src/routes/guides.ts` (`GET /api/guides`, `GET /api/guides/:topic`).

## Catalogue (31 topics, fixed ids)

| Group            | Topics                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Get started      | `install` · `scan-project` · `test-url`                                                                   |
| Explore          | `globe` · `chips` · `deep-dive` · `flow-diagram` · `open-in-editor` · `charts`                            |
| Metrics          | `score` · `lcp` · `inp` · `cls` · `ttfb` · `tbt` · `bundle` · `memory`                                    |
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
- `order`: 1–31 in catalogue order
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
9. `## Walkthrough` — exactly one fenced block with language `walkthrough` containing a JSON array of 3–6 steps `{ "screen", "area", "title", "text" }`; `screen` is one of `globe|flow|charts|compare|terminal|settings|editor|assistant|guide|live`
10. `## Learn more` — links to official docs
11. `## हिन्दी` and `## मराठी` — optional translations of "What it is" and "Use case"

Writing rules: plain language first, technical names in parentheses; never only colour words; British/International English; short sentences; consistent terms (PerfAgent, `perfagent`, `perfagent.config.ts`, `perfagent-report.json`, `.perfagent/`). Say "planned" for anything not implemented.

## Check

```bash
pnpm docs:check   # node docs/guides/check.mjs
```

The check verifies the catalogue, front matter, heading order, step format and the walkthrough JSON. CI runs it.
