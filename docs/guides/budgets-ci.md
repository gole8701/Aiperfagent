---
title: Budgets in CI
group: Fix & connect
summary: Set limits per route in perfagent.config.ts; perfagent ci fails the build and posts a pull-request comment when a limit is broken.
order: 29
tryIt: /settings/fix
---

## What it is

A budget is a limit for one metric on one route, such as "LCP on /checkout must stay under 2.5 s" or "JavaScript on / must stay under 200 KB".

`npx perfagent ci` runs a scan, checks every budget and exits with code 1 when any is over, so a pull request cannot merge a regression. With `--comment file.md` it also writes a Markdown table you can post on the pull request.

## Why it matters

Fixed problems come back silently: someone adds a library, a tag, a bigger image. Budgets make that a red check instead of a surprise next quarter.

## Use case

- Every pull request on a product site.
- A nightly check against staging.
- Turning a fixed problem into a rule with **Add to budgets** in the deep dive.

## How it helps your app

Problems cannot come back without someone noticing. The comment on the pull request names the page, the metric, the actual value, the limit and the top problems with file:line, so the author knows what to change.

## How to do it in PerfAgent, step by step

1. **Settings:** add `budgets` to `perfagent.config.ts`, or press **Add to budgets** on a problem's deep dive; the suggested limit comes from the problem's `prevent` field.
2. **Terminal:** run `npx perfagent ci` locally once to see the table.
3. **Terminal:** add the GitHub Action below to your repository; it starts your app, runs `perfagent ci --comment comment.md` and posts the comment.
4. **Compare:** after a failed check, compare the branch scan with the baseline to find the cause.
5. **Globe:** when a budget is too tight for the real world, loosen it in the config, not in the CI step.

## Commands & config

```ts
export default defineConfig({
  urls: ['http://localhost:3000', 'http://localhost:3000/checkout'],
  budgets: {
    '/': { score: 85, lcp: 2500, cls: 0.1, js: '200kb' },
    '/checkout': {
      lcp: 2500,
      inp: 200,
      ttfb: 800,
      tbt: 200,
      js: '250kb',
      aiFirstTokenMs: 1000,
      aiCacheHitRate: 0.7,
    },
  },
})
```

```bash
npx perfagent ci                       # exit 1 when a budget is over
npx perfagent ci --comment comment.md  # also write the pull-request comment
npx perfagent ci --json                # machine-readable report
```

```yaml
# .github/workflows/perfagent.yml
name: PerfAgent
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
jobs:
  budgets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm start & npx wait-on http://localhost:3000
      - run: npx perfagent ci --comment comment.md
        id: perfagent
        continue-on-error: true
      - uses: peter-evans/create-or-update-comment@v4
        if: github.event_name == 'pull_request'
        with:
          issue-number: ${{ github.event.pull_request.number }}
          body-path: comment.md
      - run: exit ${{ steps.perfagent.outcome == 'failure' && 1 || 0 }}
```

The full example lives in the repository at `.github/workflows/perfagent-example.yml`.

## Expert detail

- Budget keys (`budgetSchema` in `packages/config/src/schema.ts`): `lcp`, `inp`, `ttfb`, `tbt` in ms; `cls` as a ratio; `score` as a minimum; `js` as a size string (`'200kb'`, `'1.5mb'`); `aiFirstTokenMs` (p95) and `aiCacheHitRate` (minimum, 0–1). Unknown keys are rejected by the schema.
- A route matches a page by `page.route === route` or `page.url.endsWith(route)`. A budget for a metric that was not measured passes with the message "not measured".
- `checkBudgets` (`packages/engine/src/budgets.ts`) returns `{ route, metric, limit, actual, passed, message }` per line; `budgetsMarkdown` renders the table with a tick or cross per row and the top five open problems with file:line.
- The same check is available to the dashboard at `GET /api/budgets/:id`.
- Chrome is preinstalled on GitHub's `ubuntu-latest` runners, so no browser download is needed; on other CI images run `npx playwright install chromium`.
- Budgets fail on the median of `runs` runs; keep `runs: 3` or more in CI to avoid flaky failures, and set limits with some margin above the noise band (4 %).

## Learn more

- [web.dev: Performance budgets 101](https://web.dev/articles/performance-budgets-101)
- [GitHub Actions: Workflow syntax](https://docs.github.com/actions/writing-workflows/workflow-syntax-for-github-actions)
- [peter-evans/create-or-update-comment](https://github.com/peter-evans/create-or-update-comment)
