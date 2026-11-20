## What

One or two sentences. Which screen, command, rule, chart, importer or guide changes.

## Why

The problem or the feature inventory row it completes.

## How it was tested

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm e2e` (for dashboard changes)
- [ ] `pnpm perf-budget`
- [ ] `pnpm docs:check` (for guide changes)
- [ ] Tried on `fixtures/demo-shop`: …

## Feature ID

F\_\_ from `perfagent-build-rules.md` section 2 (or "bug" / "docs").

## Checklist

- [ ] Reused existing helpers instead of adding a parallel version
- [ ] Nothing hard-coded that belongs in `perfagent.config.ts`
- [ ] Guide entry in `docs/guides/` updated; `docs/*.md` updated for routes, config, rules or importers
- [ ] Works in dark, light and high-contrast; keyboard accessible; 390 px wide
- [ ] Security rules untouched (loopback, token, origin, path guard, redaction, write routes only in local mode)
- [ ] Changeset added for user-visible changes
