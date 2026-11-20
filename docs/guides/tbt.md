---
title: TBT
group: Metrics
summary: Total Blocking Time is how long the main thread was too busy to respond while the page loaded.
order: 15
tryIt: /charts/code
metric: tbt
---

## What it is

TBT (Total Blocking Time) adds up every moment during load when the browser was busy for more than 50 ms and could not react to a tap.

It is caused by JavaScript: big bundles, heavy third-party tags, and long tasks. It is the lab stand-in for INP and the heaviest part of the performance score (30 %).

## Why it matters

A page can look loaded and still ignore taps for seconds. TBT measures exactly that frustration.

## Use case

- After adding a tag manager, analytics or chat widget.
- Big JavaScript bundles.
- Pages that do heavy work at start-up (parsing, hydration).

## How it helps your app

The page becomes usable sooner. On the demo shop, the Google Tag Manager script in `index.html:8` is loaded synchronously, which blocks parsing; the built-in fix adds `async`.

## Good, needs work, poor

| Good     | Needs work      | Poor     |
| -------- | --------------- | -------- |
| ≤ 200 ms | 200 ms – 600 ms | > 600 ms |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **TBT** chip, or the **Third-party** or **JavaScript** area chips.
2. **Globe:** open the problem. For long tasks the chain names the script and, with source maps, the function and line.
3. **Charts:** **Network → Which outside tools slow your page?** ranks third-party scripts by blocking time.
4. **Globe:** apply the fix: `async`/`defer` on the tag, `strategy="lazyOnload"` for `next/script`, split long tasks with `scheduler.yield()`, move heavy work to a Web Worker.
5. **Globe:** **Re-test**, then add `tbt: 200` and `js: '200kb'` to the budget.

## Expert detail

- TBT = Σ (task duration − 50 ms) for every long task between First Contentful Paint and the end of the load window. Long tasks come from `PerformanceObserver({ type: 'longtask' })`; Long Animation Frames add the worst script per frame with URL, function and character offset.
- Rules: `general/blocking-third-party` (`<script src>` to known tag/analytics hosts without `async`/`defer`, in HTML assets or JSX `<script>`/`<Script>`), `general/long-tasks` (runtime, TBT over 600 ms, worst task attributed), `general/big-javascript` (over 500 KB of script), `react/namespace-import`, `react/eager-conditional-import`.
- The demo shop measured TBT 0 ms on one lab run because the synchronous GTM request fails offline; the rule still fires from the static scan of `index.html` and the gain is shown against the default of 100 ms.
- On the mobile profile CPU is slowed 4×, so TBT in the lab is often higher than on a developer laptop; that is intentional and matches PageSpeed Insights.
- `scheduler.yield()` support is reported in `page.features.schedulerYield`; when absent, fall back to `setTimeout(0)` chunks.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "chips", "title": "TBT chip", "text": "Problems that keep the main thread busy during load." },
  { "screen": "globe", "area": "chain", "title": "The blocking script", "text": "TBT → gtm.js (third party, blocking) → index.html:8." },
  { "screen": "globe", "area": "fix", "title": "async", "text": "<script async src=\"https://www.googletagmanager.com/gtm.js?id=…\">" },
  { "screen": "charts", "area": "chart-3", "title": "Which outside tools slow your page?", "text": "Third-party scripts ranked by blocking time." }
]
```

## Learn more

- [web.dev: Total Blocking Time](https://web.dev/articles/tbt)
- [web.dev: Optimize long tasks](https://web.dev/articles/optimize-long-tasks)
- [web.dev: Loading third-party JavaScript](https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript)
- [MDN: async and defer](https://developer.mozilla.org/docs/Web/HTML/Element/script#attributes)

## हिन्दी

**यह क्या है:** TBT (Total Blocking Time) वह कुल समय है जब लोड के दौरान ब्राउज़र इतना व्यस्त था कि टैप का जवाब नहीं दे सका। इसकी वजह JavaScript होती है: बड़े बंडल, भारी थर्ड-पार्टी टैग और लंबे टास्क।

**उपयोग:** टैग मैनेजर, एनालिटिक्स या चैट विजेट जोड़ने के बाद, या बड़े JavaScript बंडल वाले पेज।

## मराठी

**हे काय आहे:** TBT (Total Blocking Time) म्हणजे लोड होताना ब्राउझर इतका व्यस्त होता की टॅपला प्रतिसाद देऊ शकला नाही असा एकूण वेळ. याचे कारण JavaScript असते: मोठे बंडल, जड थर्ड-पार्टी टॅग आणि लांब टास्क.

**वापर:** टॅग मॅनेजर, अॅनालिटिक्स किंवा चॅट विजेट जोडल्यानंतर, किंवा मोठ्या JavaScript बंडलची पाने.
