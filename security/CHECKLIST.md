# Release security checklist

Run before every `v*` tag. Tick each line in the release pull request.

## Dependencies

- [ ] `pnpm audit --prod` has no high or critical findings, or each one has a written reason and an upstream issue link
- [ ] `pnpm-lock.yaml` is committed and CI installed with `--frozen-lockfile`
- [ ] Dependabot pull requests from the last cycle are merged or closed with a reason
- [ ] New dependencies since the last release were reviewed: maintainers, downloads, licence (MIT/Apache-2.0/BSD/ISC only), install scripts
- [ ] No package in this repository has a `postinstall`, `preinstall` or `prepare` script that runs code; `onlyBuiltDependencies` in `pnpm-workspace.yaml` still lists only `esbuild` and `playwright`

## Code

- [ ] `pnpm lint && pnpm typecheck && pnpm test` green, including `packages/security/test` and the server security tests (path traversal, origin rejection, token, XSS payloads, redaction, no write routes in deployed/static mode)
- [ ] CodeQL workflow green on `main`
- [ ] `grep -r "0.0.0.0" packages/*/src` finds nothing in server code
- [ ] `grep -rn "exec(\|spawn(.*shell\|execSync" packages/*/src` finds only `execFile` with argument arrays
- [ ] No new outbound network call to a PerfAgent-owned host (there must be none)
- [ ] `security/THREAT_MODEL.md` updated for any new route, importer, AI tool or write path

## Publishing

- [ ] Publishing happens only from `release.yml` on a `v*` tag, never from a laptop
- [ ] `NPM_TOKEN` is a granular automation token limited to the `perfagent` package and `@perfagent` scope, with 2FA enforced on the npm account and organisation
- [ ] `npm publish --provenance --access public` (the workflow has `id-token: write`); verify the provenance badge on npmjs.com after publish
- [ ] `npm pack --dry-run` in `packages/cli` shows only `dist`, `dashboard`, `guides`, `README.md`, `LICENSE`; no `.env`, fixtures or source maps with secrets
- [ ] Docker image built in CI from the committed `Dockerfile`, pushed to `ghcr.io/gole8701/perfagent` with the version tag and `latest`, and scanned (GitHub's container scanning or `docker scout`)
- [ ] GitHub: 2FA required for the organisation, branch protection on `main` (CI required, no force push), signed tags
- [ ] OpenSSF Scorecard run and its findings triaged (https://securityscorecards.dev)

## After publishing

- [ ] Smoke test in a clean container: `npx perfagent@latest init && npx perfagent@latest scan http://localhost:3000` against the demo shop
- [ ] `SECURITY.md` supported-versions table updated
- [ ] Changelog from changesets published with the release
