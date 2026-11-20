---
title: Test any URL
group: Get started
summary: Paste any public address and get the same measurements and problem list, without the source code.
order: 3
tryIt: /
---

## What it is

Testing a URL measures a page you do not have the code for, such as a competitor, a staging site or your own production site.

PerfAgent loads the page in a real browser with the same mobile or desktop profile as a project scan. Without source files the globe shows the page itself: the core is the page, the rings are domains (your site, CDN, third parties) and the points are requests.

## Why it matters

You can check production without deploying anything, and you can compare your site with others under identical conditions.

## Use case

- "Is production as fast as my laptop?"
- Checking a site before you have access to its repository.
- Measuring a page every week and comparing the trend.

## How it helps your app

Runtime rules still work without code: slow server (`general/slow-ttfb`), long tasks, too much JavaScript, too many requests, uncompressed text, blocking third-party scripts and large WebSocket messages all show up with the request that caused them. If the site publishes source maps, long tasks are mapped back to the original file.

## How to do it in PerfAgent, step by step

1. **Globe:** paste the address into the **Test a URL** box at the top and press Enter.
2. **Globe:** wait for the three runs. The result opens as a new report labelled with the URL.
3. **Globe:** the banner says _suggest-only_: fixes are shown as text and snippets, nothing can be applied, because the code is not here.
4. **Charts:** open **Charts → Overview** to read the same result in plain language.
5. **Compare:** add the URL report as source B next to a local scan to see what differs.

## Commands & config

```bash
npx perfagent scan https://example.com --no-project
npx perfagent scan https://example.com --device desktop --runs 5 --json > example.json
```

## Expert detail

- A URL scan is a report with `environment.mode = "deployed"` and no `tree`. Write routes (`/api/editor/*`, `/api/fix/*`) are not involved; they are only registered in local mode.
- SSRF guard (`packages/security/src/ssrf.ts`): the hostname is resolved first and private ranges (`10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `100.64/10`, IPv6 ULA and link-local) are refused. Loopback addresses are allowed only in local mode, so a hosted PerfAgent cannot be used to reach internal systems.
- Only `http:` and `https:` are accepted.
- The static website build (`apps/site`) does not run scans at all; its "Quick test" calls the PageSpeed Insights API from your browser.
- The lab profile is throttled; for real-user numbers import a CrUX or PageSpeed JSON, or add the real-user agent snippet (see **Live mode**).

## Learn more

- [web.dev: Why lab and field data can differ](https://web.dev/articles/lab-and-field-data-differences)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [OWASP: Server-Side Request Forgery](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## हिन्दी

**यह क्या है:** URL टेस्ट उस पेज को मापता है जिसका कोड आपके पास नहीं है, जैसे प्रोडक्शन साइट या किसी और की साइट। PerfAgent उसे असली ब्राउज़र में खोलता है और वही माप देता है।

**उपयोग:** "क्या प्रोडक्शन मेरे लैपटॉप जितना तेज़ है?" या किसी साइट को बिना रिपॉज़िटरी के जांचना।

## मराठी

**हे काय आहे:** URL चाचणी असे पान मोजते ज्याचा कोड तुमच्याकडे नाही, जसे प्रॉडक्शन साइट किंवा दुसऱ्याची साइट. PerfAgent ते खऱ्या ब्राउझरमध्ये उघडते आणि तीच मोजमापे देते.

**वापर:** "प्रॉडक्शन माझ्या लॅपटॉपइतके वेगवान आहे का?" किंवा रिपॉझिटरीशिवाय साइट तपासणे.
