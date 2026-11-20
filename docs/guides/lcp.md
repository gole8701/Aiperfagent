---
title: LCP
group: Metrics
summary: Largest Contentful Paint is the time until the biggest piece of content, usually the hero image or heading, is on screen.
order: 11
tryIt: /charts/speed
metric: lcp
---

## What it is

LCP (Largest Contentful Paint) is the time from the start of loading until the largest image or text block is visible.

It is the moment a visitor feels "the page has loaded". The largest element is usually a hero image, a product photo or the main heading.

## Why it matters

People leave slow pages. Google uses LCP in search ranking, and a late hero image is the most common reason a page fails the Core Web Vitals check.

## Use case

- After changing hero images, banners, fonts or the server.
- When Search Console says "LCP issue: longer than 2.5 s".
- When the page looks blank for a while on a phone.

## How it helps your app

Visitors see the page sooner, fewer leave, and the search ranking signal improves. On the demo shop, PerfAgent traces LCP 12.5 s to `loading="lazy"` on the hero image and estimates 6.9 s and +11 points after the fix.

## Good, needs work, poor

| Good    | Needs work  | Poor  |
| ------- | ----------- | ----- |
| ≤ 2.5 s | 2.5 s – 4 s | > 4 s |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **LCP** chip. Only problems that delay the main content stay lit.
2. **Globe:** open the first one. The chain names the LCP element (`img.herobanner` on the demo shop), the component and the line.
3. **Charts:** **Speed → What does your visitor see, second by second?** shows the filmstrip; the frame where the hero appears is the LCP moment.
4. **Globe:** apply the built-in fix (remove `loading="lazy"`, add `fetchpriority="high"`) or send it to your AI.
5. **Globe:** press **Re-test** to confirm the new LCP, then add a budget `lcp: 2500` for the route.

## Expert detail

- Measured with `PerformanceObserver({ type: 'largest-contentful-paint' })` in the injected script; the element is recorded as tag, id and first two class names (`page.lcpElement`). The value is the median of `runs` runs on the throttled profile.
- Rules that target LCP: `general/lcp-image-lazy` (hero `<img>`/`<Image>` with `loading="lazy"`), `next/image-priority` (hero `next/image` without `priority`), `general/uncached-api` and `general/slow-ttfb` (server time delays everything), `general/no-compression`, `general/too-many-requests`, `general/big-javascript`, `general/unused-css` (render-blocking styles), `react/namespace-import`.
- Typical LCP breakdown: TTFB → resource load delay → resource load time → render delay. "Where do the seconds go" in Charts shows server, download, script and render.
- Preloading the hero (`<link rel="preload" as="image">`) helps when the image URL is known at HTML time; `fetchpriority="high"` helps when the `<img>` is in the initial HTML.
- Field LCP (p75 of real users) can be imported from CrUX or PageSpeed JSON and is shown next to the lab value with its sample count.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "chips", "title": "LCP chip", "text": "Filter to the problems that delay the main content." },
  { "screen": "globe", "area": "chain", "title": "The LCP element", "text": "LCP 13 s → img.herobanner → <HeroBanner> → HeroBanner.tsx:5." },
  { "screen": "charts", "area": "chart-1", "title": "Filmstrip", "text": "See the frame where the hero finally appears." },
  { "screen": "globe", "area": "fix", "title": "The fix", "text": "Remove loading=\"lazy\" and add fetchpriority=\"high\". Estimated 6.9 s, +11 points." },
  { "screen": "globe", "area": "verdict", "title": "Re-test", "text": "Measure again to see predicted vs actual." }
]
```

## Learn more

- [web.dev: Largest Contentful Paint](https://web.dev/articles/lcp)
- [web.dev: Optimize LCP](https://web.dev/articles/optimize-lcp)
- [MDN: fetchpriority](https://developer.mozilla.org/docs/Web/HTML/Attribute/fetchpriority)

## हिन्दी

**यह क्या है:** LCP (Largest Contentful Paint) वह समय है जब पेज का सबसे बड़ा हिस्सा, आमतौर पर हीरो इमेज या मुख्य शीर्षक, स्क्रीन पर दिखता है। यही वह पल है जब विज़िटर को लगता है कि पेज लोड हो गया।

**उपयोग:** हीरो इमेज, बैनर, फ़ॉन्ट या सर्वर बदलने के बाद, या जब Search Console कहे कि LCP 2.5 सेकंड से ज़्यादा है।

## मराठी

**हे काय आहे:** LCP (Largest Contentful Paint) म्हणजे पानाचा सर्वात मोठा भाग, सहसा हिरो इमेज किंवा मुख्य शीर्षक, स्क्रीनवर दिसेपर्यंतचा वेळ. हाच तो क्षण जेव्हा पाहणाऱ्याला पान लोड झाल्यासारखे वाटते.

**वापर:** हिरो इमेज, बॅनर, फॉन्ट किंवा सर्व्हर बदलल्यानंतर, किंवा Search Console म्हणते की LCP 2.5 सेकंदांपेक्षा जास्त आहे तेव्हा.
