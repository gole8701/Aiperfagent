---
title: Bundle size
group: Metrics
summary: How much JavaScript the page downloads and runs, and which imports put it there.
order: 16
tryIt: /charts/code
metric: jsKb
---

## What it is

Bundle size is the amount of JavaScript a page downloads and runs before it works (metric `jsKb`), together with the number of requests and the total download.

Every kilobyte must be downloaded, parsed and executed on the main thread. On a phone that is the slowest part of most pages.

## Why it matters

JavaScript is the most expensive thing a page can send, byte for byte. It delays the main content (LCP), blocks the main thread (TBT) and costs data on mobile plans.

## Use case

- After adding a library.
- A page whose score dropped after a release with no visible change.
- Chat widgets, editors, charts and maps that most visitors never open.

## How it helps your app

Faster on phones and slow networks. On the demo shop, PerfAgent finds 1.9 MB of JavaScript and names the imports: the whole of `date-fns` (78 KB) in `src/lib/dates.ts:2`, and `ChatWidget` (~81 KB) imported eagerly in `Header.tsx:3` although it only shows when the Help button is pressed.

## Good, needs work, poor

| Metric                        | Good     | Needs work   | Poor     |
| ----------------------------- | -------- | ------------ | -------- |
| JavaScript (`jsKb`)           | ≤ 200 KB | 200 – 500 KB | > 500 KB |
| Requests                      | ≤ 50     | 50 – 120     | > 120    |
| Total download (`transferKb`) | ≤ 1.5 MB | 1.5 – 4 MB   | > 4 MB   |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **Bundle**, **Code splitting** or **Unused code** area chip.
2. **Charts:** **Code & files → What takes up space in your code?** is a treemap of files and packages; **How much downloaded code is never used?** shows unused bytes from Chrome coverage.
3. **Globe:** open a problem. The chain shows the dependency and its size, the component that imports it and the import line.
4. **Globe:** apply the fix: import only the functions you use (`import { format } from 'date-fns'`), or `lazy(() => import('./ChatWidget'))` with `<Suspense>`.
5. **Globe:** **Re-test**, then add `js: '200kb'` to the route's budget.

## Expert detail

- `jsKb` is the sum of transfer bytes of script requests in the representative run; `requests` and `transferKb` count every request. Coverage comes from the Chrome DevTools Protocol (`Profiler.takePreciseCoverage`, `CSS.takeCoverageDelta`) on the first run.
- Rules: `react/namespace-import` (`import * as` or a default import of `date-fns`, `lodash`, `moment`, `rxjs`, `@mui/icons-material`, `react-icons`, with known sizes), `react/eager-conditional-import` (a component rendered only behind a condition but imported statically, when its import subtree is over 12 KB or pulls a third-party package), `general/big-javascript` (over 500 KB), `general/too-many-requests` (over 120), `general/no-compression` (script or stylesheet over 100 KB without `br`, `gzip` or `zstd`), `general/unused-css`.
- The subtree size behind a component is computed from the import graph in the project scan (`subtreeStats`), so the ~81 KB for `ChatWidget` includes `emoji-data.ts`.
- Bundle stats (webpack stats, rollup-plugin-visualizer JSON, Vite or Next.js build manifests) can be imported (`perfagent import stats.json`) to get per-chunk sizes; the importer reports `bundle/large-chunk` and `bundle/duplicate-package` problems.
- Budgets accept sizes: `js: '200kb'` or `'1.5mb'`.

## Walkthrough

```walkthrough
[
  { "screen": "charts", "area": "chart-1", "title": "What takes up space?", "text": "A treemap of your code and the packages inside the bundle." },
  { "screen": "globe", "area": "chips", "title": "Bundle chip", "text": "date-fns, ChatWidget and two more eager imports on the demo shop." },
  { "screen": "globe", "area": "chain", "title": "Dependency to line", "text": "JS 1.9 MB → date-fns 78 KB → dates.ts:2." },
  { "screen": "globe", "area": "fix", "title": "Import only what you use", "text": "import { formatDistanceToNow, parseISO } from 'date-fns'." },
  { "screen": "globe", "area": "fix", "title": "Load on demand", "text": "const ChatWidget = lazy(() => import('./ChatWidget')) inside Suspense." }
]
```

## Learn more

- [web.dev: Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting)
- [react.dev: lazy](https://react.dev/reference/react/lazy)
- [nextjs.org: Lazy loading](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Bundlephobia](https://bundlephobia.com)

## हिन्दी

**यह क्या है:** बंडल साइज़ वह JavaScript की मात्रा है जो पेज को काम करने से पहले डाउनलोड और चलानी पड़ती है। हर किलोबाइट फ़ोन पर डाउनलोड, पार्स और रन होता है।

**उपयोग:** कोई लाइब्रेरी जोड़ने के बाद, या चैट विजेट, एडिटर, चार्ट और मैप जैसे हिस्से जिन्हें ज़्यादातर विज़िटर कभी नहीं खोलते।

## मराठी

**हे काय आहे:** बंडल साइज म्हणजे पान काम करण्यापूर्वी डाउनलोड आणि चालवावी लागणारी JavaScript ची मात्रा. प्रत्येक किलोबाइट फोनवर डाउनलोड, पार्स आणि रन होतो.

**वापर:** एखादी लायब्ररी जोडल्यानंतर, किंवा चॅट विजेट, एडिटर, चार्ट आणि नकाशे असे भाग जे बहुतेक पाहणारे कधीच उघडत नाहीत.
