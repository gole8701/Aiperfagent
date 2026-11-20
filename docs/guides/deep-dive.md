---
title: Deep dive & root cause
group: Explore
summary: One problem, fully explained: file and line, the chain from metric to code, why it happens, the fix and the expected gain.
order: 6
tryIt: /
---

## What it is

The deep dive is the panel that opens when you click a problem. It shows everything PerfAgent knows about that one problem.

Sections, top to bottom: title in plain words and in technical words, file:line with **Open in editor**, the root cause chain (metric → element or request → component → code), why it happens, the framework rule that caught it, the estimated gain, the built-in fix as before/after code, the AI fix button, a budget to prevent it coming back, links to official docs, **Re-test** and **Mark fixed**.

## Why it matters

Knowing that LCP is 12.5 s does not tell you what to change. The deep dive tells you: `loading="lazy"` on the hero image in `HeroBanner.tsx` line 5, remove it and add `fetchpriority="high"`, expect about 6.9 s and +11 points.

## Use case

- Understanding one problem before fixing it by hand.
- Reviewing what an AI fix will change before accepting it.
- Explaining a problem to a teammate with one link (`/issues/<id>`).

## How it helps your app

Each fix is specific to your code, not generic advice. The chain shows evidence at every step, so you can check it, and the gain is an estimate you can verify with **Re-test**.

## How to do it in PerfAgent, step by step

1. **Globe:** click a glowing point or a row in the problems table.
2. **Globe:** read the chain. Each step is a link: the element, the component and the code line each open their place in the code.
3. **Editor:** press **Open in editor** to jump to the exact line (local mode only).
4. **Globe:** compare the **Before** and **After** code. If the fix is marked _automatic_, PerfAgent can apply it without AI; otherwise it is a template for you or for your AI.
5. **Globe:** after changing the code, press **Re-test** to measure again and see predicted vs actual, then **Mark fixed**.

## Expert detail

- An `Issue` (`packages/core/src/types.ts`) carries: `ruleId`, `title`, `plain`, `severity`, `metrics`, `areas`, `route`, `location {file,line,column,symbol,bundled}`, `chain[]`, `why`, `frameworkRule`, `gain {metric,from,to,scoreDelta,note}`, `fix {steps,changes[],automatic}`, `prevent {route,metric,max}`, `docs[]`, `status`, `confidence`, `verified`.
- The chain is built by `buildRootCauseChain` from whatever evidence the rule has: metric → element → request → server → dependency → component → cost → code. Missing links are skipped, so a runtime-only problem may have two steps and a code problem five.
- `confidence` below 0.6 is shown as "probable". Static rules on the demo shop run at 0.85; pattern-based AI rules at 0.5–0.7.
- `location.bundled` keeps the position in the shipped bundle when a source map mapped it back to the original file.
- `gain.scoreDelta` feeds the projected score; gains are tapered when several problems share a metric (`projectedScore`).
- `prevent` is the budget suggestion shown as "Add to budgets"; it becomes a line in `budgets` in `perfagent.config.ts`.
- Source snippets for the Before box come from `GET /api/files/snippet`, which is path-guarded and redacted.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "problems-table", "title": "Pick a problem", "text": "Click the row 'Your main picture loads late' (Hero image is lazy-loaded)." },
  { "screen": "globe", "area": "deep-dive", "title": "File and line", "text": "src/components/HeroBanner.tsx:5, with an Open in editor button." },
  { "screen": "globe", "area": "chain", "title": "Root cause chain", "text": "LCP 13 s → img.herobanner → <HeroBanner> → HeroBanner.tsx:5. Every step is evidence." },
  { "screen": "globe", "area": "fix", "title": "Before and after", "text": "Remove loading=\"lazy\", add fetchpriority=\"high\". Estimated LCP 6.9 s, about +11 points." },
  { "screen": "globe", "area": "verdict", "title": "Verify", "text": "Re-test measures again and shows predicted vs actual. Mark fixed closes it." }
]
```

## Learn more

- [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp)
- [web.dev: fetchpriority](https://web.dev/articles/fetch-priority)
- [MDN: Source maps](https://developer.mozilla.org/docs/Glossary/Source_map)
