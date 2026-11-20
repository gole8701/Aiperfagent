---
title: Performance score
group: Metrics
summary: One number from 0 to 100 that sums up how fast a page is in the lab.
order: 10
tryIt: /charts/overview
metric: score
---

## What it is

The performance score is one 0–100 number that summarises the lab metrics of a page.

It is a weighted mix of Largest Contentful Paint, Total Blocking Time, Cumulative Layout Shift, First Contentful Paint and Speed Index, mapped the same way Lighthouse does it, so your PerfAgent score and your PageSpeed Insights score are comparable.

## Why it matters

A single number is easy to track, put on a slide and set as a team goal. It is also what many people mean when they say "our site scores 53".

## Use case

- Quick health check after a deploy.
- Before/after of a change, with **Compare**.
- A team goal: "every page ≥ 90 on mobile".

## How it helps your app

The score moves when the metrics behind it move. PerfAgent shows the estimated score gain next to every problem (`+11 points` for the lazy hero image), so you can pick the fixes that move the number most.

## Good, needs work, poor

| Good   | Needs work | Poor |
| ------ | ---------- | ---- |
| 90–100 | 50–89      | 0–49 |

## How to do it in PerfAgent, step by step

1. **Globe:** the score is the big number in the top-left corner card after a scan.
2. **Charts:** **Overview → How fast vs target?** shows the score and each metric as a bullet chart against its threshold.
3. **Globe:** each problem shows `+N points`; the corner card shows the projected score if the top three are fixed.
4. **Compare:** the verdict shows score A → B with a plain sentence.
5. **Settings:** add `budgets: { '/': { score: 90 } }` so `perfagent ci` fails when the score drops below 90.

## Expert detail

- Formula (`packages/core/src/score.ts`): each metric is mapped onto 0–100 with a log-normal curve anchored so that the _good_ threshold scores 90 and the _poor_ threshold scores 50, then weighted: LCP 25 %, TBT 30 %, CLS 25 %, FCP 10 %, SI 10 %. Metrics not measured are left out and the weights are renormalised.
- INP is not in the score (as in Lighthouse) because it needs a real interaction; it is reported separately.
- Projected score after fixes: the sum of `gain.scoreDelta` of open problems, tapered by up to 35 % because gains on the same metric overlap.
- Scores are from a throttled lab run (4× CPU slowdown, slow 4G on the mobile profile) and are the median of `runs` runs. Differences inside the 4 % noise band are reported as "no real change".
- The demo shop before fixes scores 54 on mobile with LCP 12.4 s, FCP 10.8 s and CLS 0.097.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "score-card", "title": "The score", "text": "The corner card shows 53 for the demo shop: usable, but visitors notice." },
  { "screen": "globe", "area": "problems-table", "title": "Points per problem", "text": "Every problem shows its estimated score gain, e.g. +11 for the lazy hero image." },
  { "screen": "charts", "area": "chart-4", "title": "How fast vs target?", "text": "Bullet charts show each metric against its good and poor thresholds." },
  { "screen": "compare", "area": "verdict", "title": "Before and after", "text": "Compare shows 53 → 78 with a sentence on what improved." }
]
```

## Learn more

- [Chrome: Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [web.dev: Web Vitals](https://web.dev/articles/vitals)

## हिन्दी

**यह क्या है:** परफ़ॉर्मेंस स्कोर 0 से 100 तक का एक अंक है जो बताता है कि पेज लैब में कितना तेज़ है। यह LCP, TBT, CLS, FCP और Speed Index का भारित मिश्रण है, Lighthouse की तरह।

**उपयोग:** डिप्लॉय के बाद जल्दी जाँच, बदलाव के पहले-बाद की तुलना, या टीम का लक्ष्य जैसे "हर पेज मोबाइल पर 90 से ऊपर"।

## मराठी

**हे काय आहे:** परफॉर्मन्स स्कोअर हा 0 ते 100 मधील एक आकडा आहे जो पान लॅबमध्ये किती वेगवान आहे ते सांगतो. तो LCP, TBT, CLS, FCP आणि Speed Index यांचे भारित मिश्रण आहे, Lighthouse प्रमाणे.

**वापर:** डिप्लॉयनंतर झटपट तपासणी, बदलापूर्वी-नंतरची तुलना, किंवा संघाचे ध्येय जसे "प्रत्येक पान मोबाइलवर 90 पेक्षा जास्त".
