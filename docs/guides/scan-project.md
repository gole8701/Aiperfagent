---
title: Scan your project
group: Get started
summary: Measure your pages in a real browser and read your source code to find the file and line behind each problem.
order: 2
tryIt: /
---

## What it is

A scan loads your pages in a real browser, reads your source files, and lists every problem with its file and line.

PerfAgent does both halves at once: the browser half measures LCP, INP, CLS and the other metrics; the code half parses your files, imports, components, hooks and JSX elements. Rules then connect the two, so "the main picture loads late" points at `src/components/HeroBanner.tsx:5`.

## Why it matters

Numbers alone do not tell you what to change. A scan ends with a ranked list of problems, each with a root cause chain, an estimated gain and a fix.

## Use case

- First look at a project you have just joined.
- Before and after a change, to prove it helped (see **Re-test & compare**).
- In CI, with `perfagent ci`, to stop regressions (see **Budgets in CI**).

## How it helps your app

Every problem comes with the exact place to change and a built-in fix. On the demo shop, one scan finds 17 problems, from the lazy-loaded hero image (LCP 12.4 s, estimated +11 points) to the whole of `date-fns` imported for two functions (78 KB).

## How to do it in PerfAgent, step by step

1. **Terminal:** start your app (for the demo: `pnpm demo` serves it on `http://localhost:3000`).
2. **Terminal:** run `npx perfagent` and open the printed dashboard URL, or run `npx perfagent scan` for a text-only result.
3. **Globe:** click **Scan**. Progress is streamed: _Reading project files_ → _Measuring … (run 1 of 3)_ → _Finding problems_.
4. **Globe:** glowing points are files with problems. The chips above the globe show counts per metric and per area.
5. **Globe:** click a point or a row in the problems table to open the deep dive with file:line, chain and fix.

## Commands & config

```bash
npx perfagent scan                           # pages from perfagent.config.ts
npx perfagent scan http://localhost:3000     # one page, same project
npx perfagent scan --device desktop --runs 5
npx perfagent scan --json > perfagent-report.json
npx perfagent scan --no-project              # measure only, do not read source files
```

```ts
export default defineConfig({
  urls: ['http://localhost:3000', 'http://localhost:3000/checkout'],
  root: '.', // folder to scan
  device: 'mobile', // 'mobile' | 'desktop'
  runs: 3, // median of N runs
  scan: {
    include: ['src/**', 'app/**', 'pages/**', 'components/**', 'lib/**', 'server/**'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    maxFiles: 20000,
  },
  rules: { packs: 'auto', disable: [] },
})
```

## Expert detail

- Pipeline (`packages/engine/src/pipeline.ts`): project scan → browser measurement → rules → report, then secrets are redacted and the report is saved as `.perfagent/reports/<id>.json`.
- Device profiles match Lighthouse defaults so numbers compare with PageSpeed Insights: mobile is 412×823 at 1.75×, 4× CPU slowdown, 1.6 Mbps down / 150 ms latency; desktop is 1350×940, no throttling.
- Each page is measured `runs` times and the median of every metric is reported, with the samples kept in the report. Run-to-run noise under 4 % is treated as "no real change".
- Signals collected in the page: `largest-contentful-paint`, `layout-shift`, `paint`, `longtask`, `long-animation-frame`, `event` (INP), `soft-navigation`, plus Chrome coverage (unused JS/CSS bytes), requests and memory through the Chrome DevTools Protocol.
- Rule packs: `general`, `realtime`, `ai` and `agents` are always on; `react` is added for React, Next.js and Remix projects; `next` for Next.js. Set `rules.packs` to a list to override.
- The project scanner reads only files matching `scan.include`, never `.env`, keys or `node_modules`.
- The report format is one JSON object (`perfagent-report.json`) validated by zod; see `docs/architecture.md`.

## Walkthrough

```walkthrough
[
  { "screen": "terminal", "area": "command", "title": "Start the dashboard", "text": "npx perfagent opens the dashboard for the project in this folder." },
  { "screen": "globe", "area": "scan-button", "title": "Scan", "text": "Click Scan. PerfAgent reads your files, then measures each page three times in a throttled mobile browser." },
  { "screen": "globe", "area": "chips", "title": "Counts per metric and area", "text": "Chips show how many problems touch LCP, INP, CLS, images, bundle, AI and more." },
  { "screen": "globe", "area": "problems-table", "title": "The ranked list", "text": "Problems are sorted by severity and estimated gain. Each row shows the file and line." },
  { "screen": "globe", "area": "deep-dive", "title": "Open one", "text": "Click a row to see the root cause chain, why it happens and the before/after fix." }
]
```

## Learn more

- [web.dev: Lab and field data](https://web.dev/articles/lab-and-field-data-differences)
- [Chrome: Performance panel](https://developer.chrome.com/docs/devtools/performance)
- [MDN: PerformanceObserver](https://developer.mozilla.org/docs/Web/API/PerformanceObserver)

## हिन्दी

**यह क्या है:** स्कैन आपके पेजों को असली ब्राउज़र में खोलता है, आपकी सोर्स फ़ाइलें पढ़ता है, और हर समस्या को उसकी फ़ाइल और लाइन के साथ सूचीबद्ध करता है।

**उपयोग:** नए प्रोजेक्ट पर पहली नज़र, किसी बदलाव के पहले और बाद में, या CI में `perfagent ci` के साथ।

## मराठी

**हे काय आहे:** स्कॅन तुमची पाने खऱ्या ब्राउझरमध्ये उघडतो, तुमच्या सोर्स फाइल्स वाचतो आणि प्रत्येक समस्या तिच्या फाइल व ओळीसह दाखवतो.

**वापर:** नवीन प्रोजेक्टवर पहिली नजर, बदलाच्या आधी आणि नंतर, किंवा CI मध्ये `perfagent ci` सह.
