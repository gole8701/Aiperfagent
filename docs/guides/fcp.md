---
title: FCP
group: Metrics
summary: First Contentful Paint is the time until the first text or picture appears on a blank screen.
order: 32
tryIt: /charts/speed
metric: fcp
---

## What it is

FCP (First Contentful Paint) is the time from the start of loading until the browser draws the first text, picture or logo.

Before that moment the visitor sees a blank screen and cannot tell whether the site is working.

## Why it matters

A long blank screen makes people think the site is broken, and many press Back. FCP is 10% of the performance score and it comes before LCP, so a late FCP also delays LCP.

## Use case

- The page stays white for a moment on a phone.
- After adding a large stylesheet, a web font or an outside script in `<head>`.
- When the server or CDN changed.

## How it helps your app

Visitors see that the page is alive sooner and wait for the rest. On the demo shop, a 234 KB stylesheet and uncompressed files keep the screen blank; removing unused CSS and turning on compression brings the first paint forward.

## Good, needs work, poor

| Good    | Needs work  | Poor  |
| ------- | ----------- | ----- |
| ≤ 1.8 s | 1.8 s – 3 s | > 3 s |

## How to do it in PerfAgent, step by step

1. **Globe:** read FCP in the Core Web Vitals card.
2. **Globe:** click the **FCP** chip. Only problems that delay the first paint stay lit.
3. **Charts:** **Speed → What does your visitor see, second by second?** The first frame that is not blank is FCP.
4. **Globe:** open a problem, apply the fix, then press **Re-test**.

## Expert detail

- Measured with `PerformanceObserver({ type: 'paint' })` (`first-contentful-paint`) in the injected script; the value is the median of `runs` runs on the throttled profile.
- Rules that move FCP: `general/unused-css` (render-blocking styles), `general/no-compression`, `general/slow-ttfb`, `general/blocking-third-party`, `general/font-display-missing`.
- FCP = TTFB + time to download and parse render-blocking CSS and scripts + first render.

## Learn more

- [web.dev: First Contentful Paint](https://web.dev/articles/fcp)
- [web.dev: Eliminate render-blocking resources](https://developer.chrome.com/docs/lighthouse/performance/render-blocking-resources)
