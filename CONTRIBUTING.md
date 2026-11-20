# Contributing

Thank you for helping. PerfAgent is built by a small team following `perfagent-build-rules.md`; this page is the short version for contributors.

## Setup

```bash
pnpm install              # pnpm 10, Node 22+
pnpm build
pnpm lint && pnpm typecheck && pnpm test
pnpm demo                 # the demo shop on http://localhost:3000
node packages/cli/dist/bin.js --root fixtures/demo-shop   # dashboard against it
```

Google Chrome or Edge must be installed for collector tests; otherwise `npx playwright install chromium`.

## Workflow for every change

1. **Pick one thing**: one feature ID from the inventory (`perfagent-build-rules.md`, section 2) or one bug. One change = one purpose.
2. **Read** the matching part of `performance-tool-research.md` before writing code.
3. **Reuse first**: search `packages/` for an existing helper, type or component. Never add a second way to do the same thing.
4. **Write the test first** (or alongside), using `fixtures/demo-shop` where possible.
5. **Implement the smallest complete change**: code + types + config option (if any) + guide entry + test.
6. **Run locally**: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e && pnpm perf-budget && pnpm docs:check`.
7. **Self-review** against the checklist below, commit, open a pull request. CI must be green before merge.

## Code quality

- TypeScript `strict`, no `any` (use `unknown` and narrow). Exported functions have explicit return types.
- Small modules with one responsibility; files under about 300 lines; functions under about 40 lines unless there is a clear reason.
- Pure logic in `core`; I/O at the edges. Packages only depend downwards (`core` ← `config/report-schema/security` ← `scanner` ← `collectors/importers/rules` ← `engine` ← `server/ai/fixer/mcp` ← `cli`); lint enforces it.
- Names say what the thing is: `buildRootCauseChain`, `lcpElement`, `reconnectBackoff`. Booleans read as questions: `isLocalMode`, `hasSourceMap`. Files are kebab-case after their main export; components PascalCase.
- Comments explain _why_, one line, no banners, no narration, no emoji.
- Errors are `PerfAgentError` with a `code` and a plain-language message plus a next step. Never swallow errors. Never log secrets. No `console.log` in committed code.
- Prettier and ESLint run in CI with zero warnings. No dead code, no commented-out code, no unused exports.
- Anything a user might change is a config option in `packages/config/src/schema.ts` with a default and a description, never hard-coded.
- Performance budgets (section 7 of the build rules) and security rules (section 8) are never relaxed "temporarily".

## Adding things through the registries

- **Rule**: add a `Rule` to `packages/rules/src/packs/<pack>.ts` (or a new pack file and one line in `allRules` in `packages/rules/src/index.ts`). Id `pack/kebab-name`, `title`, `plain`, `why`, `steps`, `docs`, `detect`. Add a fixture that triggers it and a test. Document it in `docs/rules.md` and the matching guide.
- **Chart**: add a definition to the chart registry in `packages/web/src/charts` (question, how-to-read line, takeaway function, ECharts option builder, tab). Import only the ECharts components it needs.
- **Guide**: add `docs/guides/<topic>.md` with the front matter and headings described in `docs/guides/README.md`; new topics also need a catalogue row there and in `check.mjs`. Run `pnpm docs:check`.
- **Importer**: add `packages/importers/src/formats/<name>.ts` exporting an `Importer` and register it in `importers`; add a sample file in `fixtures/reports/` and a test. Document it in `docs/import-formats.md`.
- **Config option**: add it to the zod schema with `.default()` and `.describe()`; `docs/config.md` and the Settings UI follow from `describeConfig()`.
- **Server route**: add it to a file in `packages/server/src/routes/`; write routes go only in `local.ts` or `fix.ts`, which are registered only in local mode. Document it in `docs/api.md`.

## Definition of done

- [ ] Matches the research file and the design (layout, wording, loading / empty / error states)
- [ ] Acceptance test from the feature inventory passes (unit + integration; e2e for UI)
- [ ] Works in dark, light and high-contrast themes; keyboard accessible; reduced motion respected; works at 390 px wide
- [ ] Config option added to the schema and documented, if behaviour is configurable
- [ ] Guide entry in `docs/guides/` updated
- [ ] `pnpm perf-budget` still passes
- [ ] Security tests still pass
- [ ] No new lint or type warnings; no dead code
- [ ] Feature row ticked in the inventory

## Commit messages and pull requests

Conventional, human-readable: `feat(globe): fly to issue when list row is clicked`, `fix(scanner): resolve tsconfig path aliases`, `docs(guides): add INP thresholds`. One purpose per commit.

The pull request description says **what**, **why**, **how it was tested** and the **feature ID** (the template asks for them). Add a changeset for every user-visible change (`.changeset/README.md`).

## Reporting security problems

Privately, through GitHub security advisories. See [SECURITY.md](SECURITY.md).
