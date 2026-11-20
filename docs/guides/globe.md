---
title: 3D project globe
group: Explore
summary: Your whole project on one globe; files with problems glow, and a click flies you to the cause.
order: 4
tryIt: /
---

## What it is

The globe is the home screen: your project drawn as a sphere, with folders as rings, files as points, and problems as glowing points.

The core is the project root. Each ring outward is one folder level. Points pulse red for critical problems, amber for warnings and blue for information, and their size follows the estimated gain. Drag to rotate, scroll to zoom, hover for a card, click to fly to the file and open its deep dive.

## Why it matters

A list of 16 problems is hard to prioritise. On the globe you see in seconds where problems cluster: one folder with five glowing points, or one file that touches three metrics.

## Use case

- First look at project health after a scan.
- Showing a non-technical teammate where the slow parts live.
- Spotting a folder that keeps collecting problems release after release.

## How it helps your app

The globe makes the connection between a metric and a place in the code visible. Clicking the glowing `HeroBanner.tsx` point opens the deep dive that explains why LCP is 12.5 s and how to fix it.

## How to do it in PerfAgent, step by step

1. **Globe:** run a scan (or open a saved report from the history list in the corner card).
2. **Globe:** drag to rotate, scroll to zoom, press space to pause the rotation. Keyboard: arrow keys rotate, Tab moves between glowing points, Enter opens the selected one.
3. **Globe:** hover a point to read the info card: file, problems, metrics, estimated gain.
4. **Globe:** click a point. The camera flies to it and the deep dive opens on the right.
5. **Globe:** use the chips above the globe to light up only one metric or area, and the corner cards for score, top problems and history.

## Expert detail

- Node layout comes from the project tree in the report (`report.tree`: root → dir → file → component → function → element), built by `packages/scanner` and decorated with `issueIds` and `counts` per node.
- Rendering uses Three.js through react-three-fiber with instanced meshes and frustum culling; the budget is 60 fps up to 5,000 nodes and at least 30 fps up to 20,000. Rotation pauses when the tab is hidden and when `prefers-reduced-motion` is set.
- Depth fade dims points on the far side; orbit rings are the folder levels; the glow intensity is `gain.scoreDelta` normalised across the report.
- For a URL scan without code, the tree is replaced by domains → requests (see **Test any URL**).
- Deep links: `/issues/<issueId>` opens the globe with that deep dive; `/flow/<path>` opens the same file in the flow diagram.
- Colour is never the only signal: severity is also shown by the icon and the text in the info card, and the palette is colour-blind safe.

## Walkthrough

```walkthrough
[
  { "screen": "globe", "area": "globe", "title": "Rotate and zoom", "text": "Drag to rotate, scroll to zoom. Rings are folders, points are files." },
  { "screen": "globe", "area": "globe", "title": "Glowing points", "text": "Red pulses are critical problems, amber are warnings, blue are information. Bigger means more to gain." },
  { "screen": "globe", "area": "info-card", "title": "Hover", "text": "The card names the file, its problems and the estimated gain." },
  { "screen": "globe", "area": "deep-dive", "title": "Click to fly", "text": "The camera flies to the file and the deep dive opens with the root cause chain." },
  { "screen": "globe", "area": "corner-cards", "title": "Corner cards", "text": "Score, top three problems, history and the current scan status sit in the corners." }
]
```

## Learn more

- [Three.js](https://threejs.org/docs/)
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion)
