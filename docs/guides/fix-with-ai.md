---
title: Fix with AI (local)
group: Fix & connect
summary: Let your own AI fix one problem, one file, one chip, one route or the whole site, on a new branch, with review, tests and re-tests.
order: 24
tryIt: /settings/fix
---

## What it is

Fix with AI asks the AI you connected to write code changes for the problems PerfAgent found, then applies them to a new git branch after you review them.

It runs as a loop: propose → review (Accept / Edit / Skip) → apply → run your tests → re-test the page → next problem, until the target is reached or a limit is hit. **Undo** restores every file. PerfAgent never pushes, merges or deploys.

## Why it matters

A dozen small, well-understood fixes still take an afternoon by hand. The loop does the mechanical part in minutes and leaves you the review.

## Use case

- "Fix everything on `/checkout`."
- Clearing all `Bundle` problems before a release.
- Applying the built-in fixes that are marked _automatic_ without AI at all.

## How it helps your app

Hours of work in minutes, reviewed. Each round shows predicted vs actual, so you see the real gain, not a promise. Protected paths (`fix.protected`) are never touched, and the fix branch keeps `main` clean.

## How to do it in PerfAgent, step by step

1. **Settings:** open **Settings → AI** and connect an AI (see **Connect your AI**), or use the built-in automatic fixes without one.
2. **Settings:** open **Settings → Fix** and check `review`, `runTests`, `maxRounds`, `maxFiles`, `maxCostUsd`, `protected` and the target (score, LCP, INP, CLS).
3. **Globe:** pick a scope: **Fix this** on one problem, a chip, a route in the top bar, or **Fix all** for the site.
4. **Globe:** PerfAgent creates `perfagent/fix-<date>`, and for each proposal shows a diff with **Accept**, **Edit** and **Skip**. Accepted changes are written, your tests run, and the page is re-tested.
5. **Globe:** the summary shows rounds, applied, skipped, rolled back, cost and score before → after. **Undo** restores the files; commit and push yourself when happy.

## Commands & config

```ts
export default defineConfig({
  fix: {
    review: true, // show a diff for Accept / Edit / Skip
    autoAccept: false, // apply without review (safety checks still run)
    runTests: true, // run the project tests after each change
    testCommand: undefined, // default: the test script in package.json
    autoCommit: false, // commit each accepted fix on the fix branch
    openPr: false, // open a pull request when done (never merges)
    maxRounds: 10,
    maxFiles: 40,
    maxCostUsd: 5,
    protected: ['src/payments/**'],
    target: { score: 90, lcp: 2500, inp: 200, cls: 0.1 },
  },
})
```

## Expert detail

- Requirements for local mode (all needed): server bound to `127.0.0.1`, the project is a git repository, `NODE_ENV` is not `production` (or `PERFAGENT_FORCE_LOCAL=true`), and not the static build. Otherwise the Apply button is hidden and the banner says _suggest-only_.
- Routes (only registered in local mode): `POST /api/fix/runs { reportId, scope, target?, review? }`, `GET /api/fix/runs`, `GET /api/fix/runs/:id`, `POST /api/fix/runs/:id/accept { changeIds, edits? }`, `POST /api/fix/runs/:id/skip`, `POST /api/fix/runs/:id/undo`. Events stream over `/ws` as `fix:event`: `round`, `proposal`, `applied`, `check`, `retest`, `rolled-back`, `done`, `error`.
- Scopes: `{ kind: 'issue', issueIds }`, `{ kind: 'file', file }`, `{ kind: 'chip', chip }`, `{ kind: 'route', route }`, `{ kind: 'site' }`.
- The AI only ever returns text (a `ProposedChange` with `file`, `before`, `after`, `explanation`); the fixer applies it after the path guard and the `protected` globs; it has no tool to run commands, install packages or call the network.
- A failed check (tests red, or the re-test worse than before) rolls the change back automatically (`rolled-back` event).
- If the working tree has uncommitted changes, the run stops with an error unless the request sets `stashFirst: true`; then PerfAgent runs `git stash push -m perfagent` first and **Undo** pops the stash again.
- Every run is logged to `.perfagent/audit.log` with scope and branch; code sent to the AI follows `ai.sendCode` (`snippets` by default) and is redacted.
- Checks after each change, in order: `tsc --noEmit` (when `tsconfig.json` and a local `tsc` exist), the `lint` script, the tests (`fix.testCommand` or the `test` script, when `fix.runTests` is on) and the `build` script.
- The run stops at `fix.maxRounds`, `fix.maxFiles` or `fix.maxCostUsd`, or when `fix.target.score` is reached; `target.lcp`, `target.inp` and `target.cls` are accepted but not yet used as stop conditions. `fix.autoAccept` and `fix.openPr` are accepted by the config but not used by the fixer yet; review is controlled by `fix.review`, and PerfAgent never opens pull requests.

## Walkthrough

```walkthrough
[
  { "screen": "settings", "area": "fix-settings", "title": "Limits first", "text": "Review on, tests on, max rounds, protected paths, target score." },
  { "screen": "globe", "area": "fix-button", "title": "Pick a scope", "text": "One problem, a chip, a route or the whole site." },
  { "screen": "globe", "area": "diff-review", "title": "Review each diff", "text": "Accept, Edit or Skip. Accepted changes go to the perfagent/fix-<date> branch." },
  { "screen": "terminal", "area": "command", "title": "Tests and re-test", "text": "Your tests run; the page is measured again. Worse results roll back." },
  { "screen": "globe", "area": "verdict", "title": "Summary and undo", "text": "Score before → after, cost, applied and skipped. Undo restores everything." }
]
```

## Learn more

- [Git: Branching](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- [Anthropic: Tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [OWASP: LLM Prompt Injection](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
