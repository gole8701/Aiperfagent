---
title: CLS
group: Metrics
summary: Cumulative Layout Shift measures how much the page jumps around while it loads.
order: 13
tryIt: /charts/speed
metric: cls
---

## What it is

CLS (Cumulative Layout Shift) is a score for how much visible content moves unexpectedly while the page loads and runs.

Images without a size, fonts that swap, banners and ads that push content down all add to it. It is a ratio, not a time: 0 means nothing moved.

## Why it matters

Jumping content causes mis-clicks ("I tapped Buy and hit Cancel") and feels broken. It is a Core Web Vital, so it also affects search ranking.

## Use case

- Product grids and image galleries.
- Custom web fonts.
- Cookie banners, ads, late-loading widgets.

## How it helps your app

A calm page with no surprises. On the demo shop, PerfAgent finds two causes of CLS 0.097: product images without `width` and `height` (`ProductCard.tsx:10`) and a `@font-face` without `font-display` (`fonts.css:2`), with fixes for both.

## Good, needs work, poor

| Good  | Needs work | Poor   |
| ----- | ---------- | ------ |
| ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

## How to do it in PerfAgent, step by step

1. **Globe:** click the **CLS** chip.
2. **Globe:** open each problem. The chain names the element that shifted (`<img> in ProductCard`, `text in custom font`) and the line.
3. **Charts:** **Speed → What does your visitor see, second by second?** shows the frames where content jumps.
4. **Globe:** apply the fixes: add `width` and `height` (or CSS `aspect-ratio`) to images; add `font-display: swap` to every `@font-face`.
5. **Globe:** **Re-test**, then add `cls: 0.1` to the route's budget.

## Expert detail

- Measured with `PerformanceObserver({ type: 'layout-shift' })`, ignoring shifts within 500 ms of user input (`hadRecentInput`). Each shift keeps its value, time and the first source element (`page.layoutShifts`).
- Rules: `general/image-missing-dimensions` (an `<img>` with no `width`, `height`, `fill` or aspect/size class), `general/font-display-missing` (`@font-face` without `font-display`, or a Google Fonts URL without `display=`), `next/font-missing` (Google Fonts by `<link>` instead of `next/font`).
- The lab value is the sum of shifts in the worst session window (up to 5 s, gaps under 1 s), as Chrome reports it.
- Other common causes not yet covered by a rule: content injected above existing content, animations of `top`/`left` instead of `transform`, iframes without reserved space.
- `font-display: optional` avoids the swap entirely at the cost of sometimes showing the fallback font; `swap` shows text at once and may shift once.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "chips", "title": "CLS chip", "text": "Two problems on the demo shop: product images and the web font." },
  { "screen": "globe", "area": "chain", "title": "What moved", "text": "CLS 0.11 → <img> in ProductCard → ProductCard.tsx:10." },
  { "screen": "globe", "area": "fix", "title": "Reserve the space", "text": "Add width and height so the browser keeps room before the picture arrives." },
  { "screen": "globe", "area": "fix", "title": "Font swap", "text": "Add font-display: swap to the @font-face in fonts.css." },
  { "screen": "globe", "area": "verdict", "title": "Re-test", "text": "CLS after both fixes, estimated 0.05 or lower." }
]
```

## Learn more

- [web.dev: Cumulative Layout Shift](https://web.dev/articles/cls)
- [web.dev: Optimize CLS](https://web.dev/articles/optimize-cls)
- [MDN: font-display](https://developer.mozilla.org/docs/Web/CSS/@font-face/font-display)

## हिन्दी

**यह क्या है:** CLS (Cumulative Layout Shift) बताता है कि लोड होते समय पेज की सामग्री कितनी उछलती है। बिना साइज़ की तस्वीरें, बदलते फ़ॉन्ट और बैनर इसे बढ़ाते हैं।

**उपयोग:** प्रोडक्ट ग्रिड, इमेज गैलरी, कस्टम फ़ॉन्ट, कुकी बैनर और देर से लोड होने वाले विजेट।

## मराठी

**हे काय आहे:** CLS (Cumulative Layout Shift) सांगते की लोड होताना पानातील मजकूर किती उड्या मारतो. आकार नसलेल्या प्रतिमा, बदलणारे फॉन्ट आणि बॅनर तो वाढवतात.

**वापर:** प्रॉडक्ट ग्रिड, इमेज गॅलरी, कस्टम फॉन्ट, कुकी बॅनर आणि उशिरा लोड होणारे विजेट.
