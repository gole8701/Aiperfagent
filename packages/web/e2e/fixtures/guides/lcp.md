---
title: LCP (Largest Contentful Paint)
group: Metrics
summary: Time until the biggest piece of content, usually the hero image, is visible.
order: 30
tryIt: /charts/overview
metric: lcp
---

## What it is

LCP measures when the largest image or text block becomes visible. Good is 2.5 seconds or less.

## Why it matters

Visitors judge "loaded" by the main content. A late hero image feels like a slow site.

## How to do it in PerfAgent, step by step

1. Open Charts → Overview and look at "How fast is it compared with the target?".
2. Click the LCP chip on the globe to see every LCP problem.

```walkthrough
[
  { "screen": "charts", "area": "bullets", "title": "Check the target", "text": "The marker shows your LCP against the green zone." },
  { "screen": "globe", "area": "chips", "title": "Filter by LCP", "text": "Only LCP problems stay lit." }
]
```

## Official docs

- [web.dev: Largest Contentful Paint](https://web.dev/articles/lcp)
