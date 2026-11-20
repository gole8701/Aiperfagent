---
title: 3D project globe
group: Explore
summary: See your whole project at once; problems glow, critical ones pulse.
order: 10
tryIt: /
---

## What it is

The globe shows every folder and file of your project. Problems glow: critical ones pulse red, warnings are amber, healthy files are dim.

## Why it matters

You see where problems cluster in seconds instead of reading a long list.

## How to do it in PerfAgent, step by step

1. Open the home screen.
2. Click a chip to filter the globe.
3. Click a glowing point to open the deep dive.

```walkthrough
[
  { "screen": "globe", "area": "globe", "title": "Look at the globe", "text": "Folders sit on the sphere, files orbit them. Glowing points are problems." },
  { "screen": "globe", "area": "chips", "title": "Filter with chips", "text": "Pick LCP or Images to light up only matching problems." },
  { "screen": "globe", "area": "right", "title": "Open the deep dive", "text": "Click a glowing point: the panel shows file:line, the root cause and the fix." }
]
```

## Expert detail

Points are drawn with one instanced Points mesh so 5,000 nodes stay at 60 fps.

## Hindi

ग्लोब आपके पूरे प्रोजेक्ट को एक नज़र में दिखाता है। समस्याएँ चमकती हैं।
