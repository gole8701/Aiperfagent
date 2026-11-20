---
title: Fix production problems locally
group: Fix & connect
summary: Export a report from staging or production, import it on your machine, and fix the real problems in your local code.
order: 27
tryIt: /compare
---

## What it is

This is the workflow for problems that only show on a deployed site: collect the data there, bring the report home, and fix it where the code and git are.

A deployed environment is always suggest-only: PerfAgent measures and explains, but never changes anything there. The report (`perfagent-report.json`) carries the commit SHA and the problem locations, so once imported locally the globe shows production problems on your local files.

## Why it matters

Production is where users are slow, but production is never the place to edit code. This keeps both rules: measure where it matters, change where it is safe.

## Use case

- A CI run against the staging URL found a regression.
- A colleague without the repository scanned production and sent you the JSON.
- A Lighthouse or PageSpeed report from a client.

## How it helps your app

Real problems, fixed safely, then verified: the next production report compared with the previous one shows the before and after of the deploy.

## How to do it in PerfAgent, step by step

1. **Terminal:** on the deployed side, `npx perfagent scan https://staging.example.com --no-project --json > perfagent-report.json`, or press **Export → JSON** in a dashboard pointed at that URL.
2. **Globe:** on your machine, run `npx perfagent` in the project and drop the file onto the dashboard (or `npx perfagent import perfagent-report.json`).
3. **Globe:** PerfAgent validates the file, strips secrets, and maps locations to your files. It warns when your local commit differs from the report's `build.commit`.
4. **Globe:** fix as usual: open in editor, built-in fix or **Fix with AI** on a new branch, then **Re-test** locally.
5. **Compare:** after deploying, scan production again and compare the two reports to confirm.

## Commands & config

```bash
# Deployed side (any machine, no repository needed)
npx perfagent scan https://staging.example.com --no-project --json > perfagent-report.json

# Local side
npx perfagent import ./perfagent-report.json
npx perfagent compare <before-id> <after-id>
npx perfagent export latest --format md --out pr-comment.md
```

```ts
export default defineConfig({
  environments: {
    staging: { url: 'https://staging.example.com' },
    production: { url: 'https://www.example.com' },
  },
})
```

## Expert detail

- Mode is detected per server start (`detectMode`): a report's `environment.mode` is `local`, `deployed` or `imported`. Imported reports keep their origin so the UI can say "measured on production, mapped to local files".
- Import route: `POST /api/import` with the raw body and an `X-Filename` header, or `POST /api/import/text { text }`; both return `{ reportId, format, exact, detected, warnings }`. `POST /api/import/:id/correct` fixes low-confidence values read from PDF, Word or Excel.
- Every import is untrusted: 60 MB cap, zod schema validation of the report, never executed, redacted, and shown as text. Text inside a report is data, never instructions for the AI.
- Source maps: when the deployed bundle publishes source maps, long tasks and bundled locations are mapped to original `file:line` and the bundled position is kept in `location.bundled`.
- A report from a different commit is still usable; the mismatch warning names both SHAs so you can check out the right one.
- Never included in a report: cookies, auth headers, tokens, form values, personal data; redaction runs at collection time and again at import.

## Walkthrough

```walkthrough
[
  { "screen": "terminal", "area": "command", "title": "Export from the deployed site", "text": "npx perfagent scan https://staging… --no-project --json > perfagent-report.json" },
  { "screen": "globe", "area": "import-drop", "title": "Import locally", "text": "Drop the JSON onto the dashboard. It is validated, cleaned and mapped to your files." },
  { "screen": "globe", "area": "banner", "title": "Commit check", "text": "A warning shows if your checkout differs from the report's commit." },
  { "screen": "globe", "area": "deep-dive", "title": "Fix locally", "text": "Production problems on local files: open in editor or fix with AI on a branch." },
  { "screen": "compare", "area": "verdict", "title": "Before vs after deploy", "text": "The next production report compared with this one." }
]
```

## Learn more

- [MDN: Source maps](https://developer.mozilla.org/docs/Glossary/Source_map)
- [Chrome: Lighthouse JSON output](https://developer.chrome.com/docs/lighthouse/overview#cli-options)
- [zod](https://zod.dev)
