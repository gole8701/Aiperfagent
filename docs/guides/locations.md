---
title: Test from other locations
group: Live & locations
summary: Measure the same page from different regions to see who waits the longest. Planned as a hosted feature; today you can import regional data.
order: 19
tryIt: /charts/users
---

## What it is

Testing from other locations runs the same scan from servers in different parts of the world, so you see how far-away users experience the site.

**Status: planned.** The config option `locations` exists and is accepted, but running scans from remote regions needs servers, which is part of the hosted edition. Today, PerfAgent shows regional data you import (CrUX or PageSpeed JSON with country breakdowns, or real-user samples from the agent snippet).

## Why it matters

A site that is fast in Frankfurt can be slow in Mumbai or São Paulo. TTFB and LCP grow with distance unless a CDN and caching are in place.

## Use case

- A global audience with one origin server.
- Deciding whether a CDN or edge rendering is worth it.
- Checking that a new region performs after adding a CDN.

## How it helps your app

Knowing _who_ is slow and _where_ lets you fix the right thing: move static files to a CDN, cache HTML at the edge, or pick a closer region for the API.

## How to do it in PerfAgent, step by step

1. **Settings:** add `locations: ['mumbai', 'frankfurt']` in `perfagent.config.ts`. Today this is stored but not run.
2. **Charts:** open **Users & places → Which countries wait the longest?**. It fills from imported CrUX/PageSpeed data or from the agent snippet's real-user samples.
3. **Compare:** import two PageSpeed JSON files for the same page tested from different places and compare them side by side.
4. **Globe:** read the TTFB problem for the deployed URL; distance shows up there first.

## Commands & config

```ts
export default defineConfig({
  locations: [], // e.g. ['mumbai', 'frankfurt'] — accepted now, runs when the hosted feature ships
})
```

```bash
# Until then: import regional field data
npx perfagent import ./crux-india.json
npx perfagent import ./psi-germany.json
npx perfagent compare <id-a> <id-b>
```

## Expert detail

- Config: `locations: string[]` (default `[]`), described in the schema as "Regions to test from (hosted feature)". The report format already carries `environment.region`, so regional reports import and compare like any other.
- The scan pipeline is location-agnostic: a scan runner in a region produces the same `perfagent-report.json`; the hosted edition will run the same code in containers and return reports to the dashboard.
- Real-user data is compared at p75 with the sample count shown (`MetricValue.p75`, `sampleCount`).
- For a cheap approximation today, run `npx perfagent scan https://your-site` from a VM in the target region and import the JSON locally.

## Learn more

- [Chrome UX Report (CrUX)](https://developer.chrome.com/docs/crux)
- [web.dev: Content delivery networks](https://web.dev/articles/content-delivery-networks)
- [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started)
