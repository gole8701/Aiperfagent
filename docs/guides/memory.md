---
title: Memory
group: Metrics
summary: The memory a page keeps using the longer it stays open, and the leaks that make it grow.
order: 17
tryIt: /charts/live
metric: memoryMb
---

## What it is

Memory (JavaScript heap) is how much memory the page holds, and whether it keeps growing the longer the tab stays open.

A healthy single-page app settles at a flat line. A leaking one grows with every route change until it slows down or crashes the tab.

## Why it matters

Dashboards, chat apps and shops are often open for hours. Leaks do not show in a 10-second lab test but ruin long sessions, especially on phones with little memory.

## Use case

- Single-page apps with client-side routing.
- Pages with timers, WebSockets, observers or subscriptions.
- "It gets slower the longer I use it."

## How it helps your app

No slowdown or crash after long use. On the demo shop, `LiveStock` starts a `setInterval` in `useEffect` and never clears it (`src/components/LiveStock.tsx:8`), so every visit to the home page leaves another poller running; the fix returns a cleanup that clears the interval.

## Good, needs work, poor

| Good                       | Needs work  | Poor                |
| -------------------------- | ----------- | ------------------- |
| ≤ 50 MB and flat over time | 50 – 150 MB | > 150 MB or growing |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **Memory** area chip.
2. **Globe:** open the problem. The chain shows the component and the effect line that starts a timer, listener, socket or observer without cleanup.
3. **Live:** start **Live mode** on the page and change routes a few times; **Charts → Live & server → Does the app get heavier the longer it's open?** draws the heap over time.
4. **Globe:** apply the fix: return a cleanup from the effect (`clearInterval`, `removeEventListener`, `socket.close()`, `observer.disconnect()`).
5. **Live:** repeat the route changes; the line should go flat.

## Expert detail

- Lab value: `memoryMb` is the JS heap (`Performance.getMetrics` → `JSHeapUsedSize`) after load, median across runs; the demo shop reports 8.9 MB on load, which is why the growth only shows in live mode.
- Live mode samples the heap every second through CDP and keeps it in `live.memoryMb[]`; the chart flags a trend when the window keeps rising.
- Rule: `react/effect-without-cleanup` (`useEffect`/`useLayoutEffect` without a returned cleanup that calls `setInterval`, `setTimeout`, `addEventListener`, `.subscribe`, `.on`, `new WebSocket`, `new EventSource`, `new ResizeObserver`, `new IntersectionObserver` or `new MutationObserver`).
- Other common leaks not yet covered by a rule: closures captured by global caches, detached DOM nodes held by listeners, growing arrays in module scope.
- For the dashboard itself the budget is a flat heap after 20 route changes; `pnpm perf-budget` checks the initial JavaScript size and dashboard ready time.

## Learn more

- [react.dev: useEffect cleanup](https://react.dev/reference/react/useEffect#connecting-to-an-external-system)
- [Chrome: Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
- [MDN: Memory management](https://developer.mozilla.org/docs/Web/JavaScript/Memory_management)

## हिन्दी

**यह क्या है:** मेमोरी (JavaScript हीप) बताती है कि पेज कितनी मेमोरी रखता है और टैब जितना ज़्यादा खुला रहे, क्या यह बढ़ती जाती है। स्वस्थ ऐप एक सपाट रेखा पर टिकता है; लीक वाला ऐप बढ़ता रहता है।

**उपयोग:** सिंगल-पेज ऐप, टाइमर या WebSocket वाले पेज, या "जितना इस्तेमाल करो उतना धीमा होता है"।

## मराठी

**हे काय आहे:** मेमरी (JavaScript हीप) सांगते की पान किती मेमरी धरून ठेवते आणि टॅब जितका जास्त वेळ उघडा राहील तितकी ती वाढते का. निरोगी अॅप सपाट रेषेवर स्थिर राहते; लीक असलेले अॅप वाढत राहते.

**वापर:** सिंगल-पेज अॅप, टायमर किंवा WebSocket असलेली पाने, किंवा "जितके वापरावे तितके हळू होते".
