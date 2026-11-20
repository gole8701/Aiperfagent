---
title: Re-test & compare
group: Fix & connect
summary: Measure again after a fix to see predicted vs actual, and compare any two or more sources: scans, URLs, JSON, PDF, Excel, Word, pasted text or a dashboard link.
order: 28
tryIt: /compare
---

## What it is

Re-test measures one page again after a change and writes the result next to the prediction. Compare puts two or more reports side by side and says, in plain words, what got better, what got worse and why.

Compare accepts almost anything: a saved scan, a fresh URL, a PerfAgent JSON, a Lighthouse or PageSpeed JSON, a HAR, a PDF, an Excel sheet, a Word document, pasted text, or a link to another PerfAgent dashboard or exported report. Machine formats are exact; documents are read best-effort with a check step.

## Why it matters

A fix is only a fix when the numbers move. Re-test proves it; Compare catches slowdowns before users do, release after release.

## Use case

- Before/after of one change on the same page.
- `/home` vs `/checkout`: why is one slower?
- Release v1.4 vs v1.5 across four pages.
- Last month's PDF report from an agency vs today's scan.

## How it helps your app

Changes smaller than run-to-run noise are shown as "no real change", so you do not chase ghosts. Every real change is tied to a cause when the data allows it: a new request, a bigger package, a fixed or new problem.

## How to do it in PerfAgent, step by step

1. **Globe:** after changing code, open the problem and press **Re-test**. The page is measured three times; the deep dive shows predicted vs actual and the problem can be marked fixed.
2. **Compare:** open **Compare** and add sources A and B (and C…): pick from history, paste a URL, drop a file or paste text.
3. **Compare:** for a PDF, Word or Excel source, check the **Detected values** step; values with low confidence are flagged for you to correct.
4. **Compare:** read the verdict (score A → B and three sentences), the metric-by-metric bars, the many-pages grid, and **Where is the impact?** with file:line.
5. **Compare:** use **Show only what got worse**, then **Fix what got worse with my AI**, **Save as new baseline** or **Add budgets for these metrics**; export as PDF, PNG or Markdown for a pull request.

## Commands & config

```bash
npx perfagent compare <report-id-a> <report-id-b>
npx perfagent compare before.json after.json
npx perfagent compare lighthouse-mobile.json ./agency-report.pdf
npx perfagent export <id> --format md --out pr-comment.md
```

## Expert detail

- Re-test: `POST /api/scans/:id/retest { issueId }` runs `retestIssue`, measures the issue's route three times without coverage, and stores `verified { metric, predicted, actual, at }` on the issue.
- Compare: `POST /api/compare { sources: [...], routeA?, routeB? }` with up to five sources of kind `report`, `url`, `text` or `link`. Extra sources are each compared against A. The result is a `Comparison` with `mode` (`before-after`, `page-vs-page`, `many-pages`), `verdict`, `diffs[]`, `impact[]`, `nextSteps[]`, `warnings[]`.
- Metrics compared: score, LCP, INP, CLS, TTFB, FCP, TBT, JS size, requests, AI first token, AI cost. Changes inside `NOISE_RATIO` (4 %) are "No real change". Labels are `+N points` for scores and `N % better/worse` for the rest.
- Impact signals: problems fixed / new / still open between A and B, new or bigger requests, bigger packages, new long tasks, more re-renders, server-timing changes, and a git diff when both reports carry commit SHAs. Without raw data the verdict says "cause unknown: re-scan to find the cause".
- Fairness warnings: different device profile, different page, or real-user vs lab data.
- Importers (`packages/importers`): `perfagent`, `psi`, `lighthouse`, `har`, `trace`, `bundle-stats`, `otel`, `web-vitals`, `csv`, `pdf`, `xlsx`, `docx` and `text`; Compare also accepts a `dashboard-link`. See `docs/import-formats.md`.
- A dashboard link source carries `?report=<id>`; an exported report link ends in `.json` and is fetched with a 15 s timeout.

## Learn more

- [web.dev: Lab and field data](https://web.dev/articles/lab-and-field-data-differences)
- [Chrome: Lighthouse variability](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring#variability)
- [MDN: HAR format](https://developer.mozilla.org/docs/Glossary/HAR)
