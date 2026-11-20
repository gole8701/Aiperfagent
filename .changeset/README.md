# Changesets

Every user-visible change ships with a changeset: a small Markdown file in this folder that names the packages it touches, the bump type and one or two sentences for the changelog. Changesets are collected into version bumps and `CHANGELOG.md` entries at release time.

## Wiring (lead)

The dependency is not yet added to `package.json`; to enable:

```bash
pnpm add -Dw @changesets/cli @changesets/changelog-github
```

and add the scripts `"changeset": "changeset"`, `"version": "changeset version"`, `"release": "pnpm build && changeset publish"`. `config.json` here is ready: all publishable packages (`perfagent` and `@perfagent/*`) are versioned together (`fixed`), the changelog links GitHub pull requests, and private workspace packages are ignored.

## Adding a changeset

```bash
pnpm changeset
```

Pick the packages (usually `perfagent`), the bump (`patch` for fixes, `minor` for features, `major` for breaking changes) and write the summary in plain language, as a user would read it:

```md
---
'perfagent': minor
---

Deep dive: "Add to budgets" writes the suggested limit into perfagent.config.ts.
```

Commit the generated file with your change. Docs-only and internal changes need no changeset.

## Releasing

1. Merge the "Version Packages" pull request that the changesets action opens (or run `pnpm version` locally and open one).
2. Tag `vX.Y.Z` on `main`. `release.yml` builds, tests, publishes to npm with provenance and pushes the Docker image.
