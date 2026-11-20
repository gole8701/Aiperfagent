---
title: Charts view
group: Explore
summary: Eight tabs of plain-language charts, each with a question as its title and a one-line answer underneath.
order: 9
tryIt: /charts/overview
---

## What it is

Charts view shows the scan as charts a non-technical person can read. Every chart is titled with a question, has a "how to read it" line, and ends with one sentence that says what it means.

The eight tabs are **Overview**, **Speed**, **Code & files**, **Network**, **Live & server**, **AI**, **Users & places** and **Business impact**. The first card on Overview is **In simple words**: a headline and three sentences generated from the data, no AI needed.

## Why it matters

Founders, product managers and designers decide what gets fixed. They need the answer to "what slows the page the most?" without reading a waterfall.

## Use case

- A weekly health check that anyone in the team can read.
- Choosing the first three fixes with a product owner.
- Exporting one chart as PNG for a slide or a pull-request comment.

## How it helps your app

Every bar links back to the problem on the globe, so a decision made in Charts turns into a fix in the deep dive. The same chip filter applies, so "only LCP" stays "only LCP" across screens.

## How to do it in PerfAgent, step by step

1. **Charts:** open **Charts** from the menu, or `/charts/overview`.
2. **Charts:** read **In simple words** first: on the demo shop it says the page is _"Usable, but 16 things slow it down"_ and that fixing the top three gives about +20 points.
3. **Charts:** scroll the Overview charts: what slows the page most, where the seconds go (server, download, script, render), what kind of problems, how fast vs target, better or worse over time.
4. **Charts:** switch tabs. **Speed** shows the filmstrip and a simplified waterfall; **Code & files** the treemap of your code and unused bytes; **Network** who the page downloads from.
5. **Charts:** click any bar to open the matching problem; press the export icon on a chart for PNG, or the page export for PDF.

## Expert detail

- The 35 charts are definitions in a registry in the web package (`packages/web/src/charts`), each with a question, a reading hint, a takeaway function and an ECharts option builder. Adding a chart means adding one definition; the tabs render from the registry.
- Charts are built with Apache ECharts, imported modularly (only the chart types in use), to keep the dashboard's initial JavaScript under the 250 KB gzip budget. Highcharts is not used because of its commercial licence.
- Data sources per tab: Overview, Speed, Code and Network need a normal scan; Live & server needs a live session; AI needs `watchAI` or imported OpenTelemetry GenAI data; Users & places needs real-user data (agent snippet or CrUX import); Business impact needs an analytics connector, which is _planned_; that tab says so and shows sample data until connected.
- "In simple words" is `summarise(report)` from `packages/core/src/plain.ts`: headline by score band, Core Web Vitals that are not green, projected gain of the top three with tapering for overlapping gains.
- "Where do the seconds go" uses `page.phases` (server, download, script, render) from the representative run.
- Estimates are labelled "estimate". Colour is never the only signal: every bar has its value and a label.

## Walkthrough

```walkthrough
[
  { "screen": "charts", "area": "summary", "title": "In simple words", "text": "A headline and three sentences from the data: what is slow now, what the top three fixes give, where to start." },
  { "screen": "charts", "area": "chart-1", "title": "What slows your page the most?", "text": "Bars sorted by estimated gain. Click one to open its deep dive." },
  { "screen": "charts", "area": "chart-2", "title": "Where do the seconds go?", "text": "Server, download, script and render time as one stacked bar." },
  { "screen": "charts", "area": "tabs", "title": "Eight tabs", "text": "Speed, Code & files, Network, Live & server, AI, Users & places, Business impact." },
  { "screen": "charts", "area": "export", "title": "Export", "text": "PNG per chart, PDF for the page, Markdown for a pull request." }
]
```

## Learn more

- [Apache ECharts](https://echarts.apache.org/en/index.html)
- [web.dev: User-centric performance metrics](https://web.dev/articles/user-centric-performance-metrics)
- [Chrome: Filmstrip in the Performance panel](https://developer.chrome.com/docs/devtools/performance/reference#film-strip)
