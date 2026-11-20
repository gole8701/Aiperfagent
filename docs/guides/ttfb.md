---
title: TTFB
group: Metrics
summary: Time to First Byte is how long the server takes before it starts sending the page.
order: 14
tryIt: /charts/network
metric: ttfb
---

## What it is

TTFB (Time to First Byte) is the time from the request leaving the browser until the first byte of the response arrives.

It includes DNS, connection, TLS, the server's own work (database, rendering, APIs) and the distance to the server. Everything else on the page waits for it.

## Why it matters

A slow first byte delays every other metric. No image, script or font can start before the HTML arrives.

## Use case

- Server-rendered pages that query a database on every request.
- APIs without caching.
- Servers far from your users, cold starts on serverless platforms.

## How it helps your app

Everything starts sooner. On the demo shop, PerfAgent finds `/api/products` answered without any `Cache-Control` header (`src/server/api/products.ts:22`), so every visit waits for the simulated database again; the fix adds `s-maxage=60, stale-while-revalidate=300`.

## Good, needs work, poor

| Good     | Needs work     | Poor    |
| -------- | -------------- | ------- |
| ≤ 800 ms | 800 ms – 1.8 s | > 1.8 s |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **TTFB** chip, or the **Server**, **API** or **Caching** area chips.
2. **Globe:** open the problem. For code problems the chain shows the handler function and the line; for URL scans it shows the document request and its timing.
3. **Charts:** **Overview → Where do the seconds go?** shows the server share; **Network → On a second visit, how much is reused?** shows what caching gives.
4. **Globe:** apply the fix: a `Cache-Control` header, the framework's `revalidate`, a CDN in front, or `Server-Timing` headers to find the slow part.
5. **Globe:** **Re-test**, then add `ttfb: 800` to the budget.

## Expert detail

- Measured from the Navigation Timing entry (`responseStart − requestStart`) on the document request; the demo shop on localhost reports 150 ms, which is why its `general/slow-ttfb` rule does not fire.
- Rules: `general/slow-ttfb` (runtime, over 1.8 s), `general/uncached-api` (a handler that sends JSON with `res.json`/`res.send`/`NextResponse.json`/`Response.json` and no `cache-control`, `revalidate`, `max-age` or `no-store` in its body), `next/fetch-no-store` (`fetch(..., { cache: 'no-store' })` for data that is not per-user).
- `Server-Timing` response headers are read when present and shown as the server split in **Live & server → What is your server busy with?**.
- Lab TTFB on localhost is not representative of production; test the deployed URL (see **Test any URL**) or import real-user data.
- Keep `no-store` for personal data (cart, account); cache public data with `s-maxage` at the CDN and `stale-while-revalidate` for freshness.

## Learn more

- [web.dev: Time to First Byte](https://web.dev/articles/ttfb)
- [web.dev: Optimize TTFB](https://web.dev/articles/optimize-ttfb)
- [MDN: Cache-Control](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control)
- [MDN: Server-Timing](https://developer.mozilla.org/docs/Web/HTTP/Headers/Server-Timing)

## हिन्दी

**यह क्या है:** TTFB (Time to First Byte) वह समय है जो सर्वर को पेज भेजना शुरू करने में लगता है। बाकी सब कुछ इसी का इंतज़ार करता है।

**उपयोग:** हर अनुरोध पर डेटाबेस से पढ़ने वाले पेज, बिना कैश वाले API, दूर के सर्वर या सर्वरलेस कोल्ड स्टार्ट।

## मराठी

**हे काय आहे:** TTFB (Time to First Byte) म्हणजे सर्व्हरला पान पाठवायला सुरुवात करण्यास लागणारा वेळ. बाकी सर्व काही याचीच वाट पाहते.

**वापर:** प्रत्येक विनंतीवर डेटाबेस वाचणारी पाने, कॅश नसलेले API, दूरचे सर्व्हर किंवा सर्व्हरलेस कोल्ड स्टार्ट.
