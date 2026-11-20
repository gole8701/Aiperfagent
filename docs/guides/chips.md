---
title: Filter with chips
group: Explore
summary: One click shows only the problems for one metric or one area, on the globe, in the list and in the charts.
order: 5
tryIt: /
---

## What it is

Chips are the filter buttons above the globe. Each chip is a metric (LCP, INP, CLS, TTFB, TBT, FCP, AI first token, AI cost, Agents) or an area (Images, Bundle, Re-renders, API, WebSocket and more), with a count of open problems.

Selecting a chip filters the globe, the problems table and the charts at the same time, so every screen tells the same story.

## Why it matters

Teams fix one kind of problem at a time: "this sprint we fix LCP" or "only bundle issues". Chips make that a single click instead of a search.

## Use case

- Fix LCP first, because it is the metric that failed in Search Console.
- Show only `Third-party` problems to a marketing team that owns the tags.
- Count how many problems are about AI before a chatbot launch.

## How it helps your app

Focus. With the `Images` chip selected on the demo shop you see two problems: the lazy hero image and the product image without dimensions. With `Bundle` you see `date-fns`, the chat widget and the two other eagerly imported components.

## How to do it in PerfAgent, step by step

1. **Globe:** read the counts on the chips after a scan. `All` shows the total of open problems.
2. **Globe:** click a metric chip such as **LCP**. Only points whose problems affect LCP keep glowing; the table shrinks to match.
3. **Globe:** click an area chip such as **Re-renders** to filter by cause instead of effect.
4. **Charts:** the same chip stays selected in Charts, so the bar chart of problems is filtered too.
5. **Globe:** click the chip again, or **All**, to clear the filter.

## Expert detail

- Metric chips come from `CHIP_METRICS` in `packages/core/src/areas.ts`: `lcp`, `inp`, `cls`, `ttfb`, `tbt`, `fcp`, `aiFirstTokenMs`, `aiCostUsd`, `agentReadiness`. Area chips are the 21 `AREAS`, grouped as Server & network, JavaScript, Images & fonts, Styles, Memory, AI and Other.
- Counts are computed by `countChips(issues)` over open issues only; fixed or ignored problems drop out of the counts.
- A problem can appear under several chips: `general/uncached-api` is counted under TTFB and LCP, and under the areas API, Caching and Server.
- The API accepts the filter as `GET /api/issues?filter=metric:lcp` or `filter=area:bundle`, optionally with `&route=/checkout`.
- The selected chip is part of the URL, so a filtered view can be bookmarked or shared with a teammate.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "chips", "title": "Counts", "text": "Each chip shows how many open problems touch that metric or area." },
  { "screen": "globe", "area": "chips", "title": "Pick a metric", "text": "Click LCP. Only files whose problems delay the main content stay lit." },
  { "screen": "globe", "area": "problems-table", "title": "Same filter in the list", "text": "The problems table shows the same subset, still sorted by severity and gain." },
  { "screen": "charts", "area": "chart-1", "title": "Same filter in Charts", "text": "Charts keep the chip, so the bars count only the filtered problems." },
  { "screen": "globe", "area": "chips", "title": "Clear", "text": "Click All, or the chip again, to see everything." }
]
```

## Learn more

- [web.dev: Core Web Vitals](https://web.dev/articles/vitals)
- [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp)
- [web.dev: Optimize INP](https://web.dev/articles/optimize-inp)
