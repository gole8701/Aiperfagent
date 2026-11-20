---
title: Themes & export
group: Settings
summary: Dark, light, system and high-contrast themes with a colour-blind-safe palette; export any report as JSON, CSV, Markdown or a single HTML file.
order: 31
tryIt: /settings/display
---

## What it is

Themes change how the dashboard looks: dark, light, follow the system, or high contrast. Export turns a report into a file you can send, attach to a ticket or re-import later.

Export formats from the server: **JSON** (the exact `perfagent-report.json`, re-imports identically), **CSV** (metrics and problems as rows), **Markdown** (ready to paste into a pull request or ticket), **HTML** (one offline file with the report embedded as text). Charts also export as PNG and the page as PDF from the browser.

## Why it matters

People read in different conditions and with different eyes; colour is never the only signal in PerfAgent. And a result that cannot leave the dashboard cannot be discussed in a review, a ticket or a slide.

## Use case

- A pull-request comment with the problems and fixes.
- A report for a client or a manager as a single HTML file.
- Moving a scan from one machine to another (JSON).

## How it helps your app

The team sees the same numbers in the same words wherever the discussion happens, and every export carries the file:line evidence.

## How to do it in PerfAgent, step by step

1. **Settings:** open **Settings → Display** and pick a theme: `system`, `dark`, `light` or `high-contrast`. The choice is saved in `.perfagent/settings.json`.
2. **Settings:** pick the guide language (`en`, `hi`, `mr`); guides with translations show the Hindi and Marathi sections.
3. **Globe:** press **Export** in the top bar and choose JSON, CSV, Markdown or HTML; the file downloads.
4. **Charts:** use the export icon on a chart for PNG, or the page export for PDF.
5. **Compare:** export a comparison as Markdown for a pull request.

## Commands & config

```ts
export default defineConfig({
  theme: 'system', // 'system' | 'dark' | 'light' | 'high-contrast'
  language: 'en', // 'en' | 'hi' | 'mr'
})
```

```bash
npx perfagent export latest --format json --out perfagent-report.json
npx perfagent export <id> --format csv --out report.csv
npx perfagent export <id> --format md --out pr-comment.md
npx perfagent export <id> --format html --out report.html
```

## Expert detail

- Route: `GET /api/export/:id?format=json|csv|md|html` returns the file with a `Content-Disposition: attachment` header (`packages/server/src/export.ts`).
- The HTML export escapes the Markdown into a `<pre>` block and embeds the report JSON in a `<script type="application/json">` tag with `<` escaped, so nothing in a report can execute when the file is opened.
- CSV has two tables: `page, metric, value, unit` and `severity, title, plain, file, line, metric, gain_points, first_step`.
- Markdown contains the "in simple words" summary, a metric table per page with ratings, and each open problem with why, fix steps and the first before/after diff.
- Settings changed in the dashboard are an overlay in `.perfagent/settings.json`; `perfagent.config.ts` is never rewritten. Only these sections can be changed from the UI: `device`, `runs`, `editor`, `theme`, `language`, `ai`, `fix`, `live`, `budgets`, `rules`, `urls`.
- Themes meet WCAG contrast in all four modes; the palette is colour-blind safe and every coloured element also has a label, value or icon. Reduced motion is respected (globe rotation, flow animation, guide diagrams and screenshot pointer). The layout works at 390 px wide.
- Exports are redacted like everything else; secrets never reach a file.

## Learn more

- [MDN: prefers-color-scheme](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-color-scheme)
- [WCAG: Contrast (minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [MDN: Content-Disposition](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Disposition)
