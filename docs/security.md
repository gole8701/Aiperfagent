# Security

PerfAgent is designed so that it has no ability to do dangerous things, rather than promising it will not. This page is the short version; the threat model with attackers, assets and residual risks is in [`security/THREAT_MODEL.md`](../security/THREAT_MODEL.md), the release checklist in [`security/CHECKLIST.md`](../security/CHECKLIST.md), and vulnerability reporting in [`SECURITY.md`](../SECURITY.md).

## The promises

| Promise                     | How                                                                                                                                                                        | Where                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Local only                  | The server binds to `127.0.0.1`, never `0.0.0.0`                                                                                                                           | `packages/server/src/app.ts` (`HOST`)                                           |
| Secret token                | 32 random bytes per start, constant-time comparison; accepted as Bearer header, `?token=` or cookie; missing → 401                                                         | `packages/security/src/token.ts`                                                |
| Other websites are rejected | Host must be loopback on the server port; Origin must match when present; `Origin: null` and cross-site `Sec-Fetch-Site` rejected → 403                                    | `packages/security/src/origin-check.ts`                                         |
| Strict CSP                  | `default-src 'self'`, scripts from self only, `connect-src` limited to local ports, `frame-ancestors 'none'`, `nosniff`, `no-referrer`, COOP/CORP, `no-store`              | `packages/security/src/csp.ts`                                                  |
| Read-only by default        | Write routes exist only in local mode and never in the static build                                                                                                        | `packages/server/src/routes/index.ts`, `packages/security/src/mode.ts`          |
| No "run any command"        | No endpoint executes user-supplied commands; editor and git use `execFile` with fixed argument arrays                                                                      | `packages/server/src/editor.ts`                                                 |
| Path guard                  | Real path (symlinks resolved) must stay inside the project root; `.env*`, keys, `.npmrc`, `.netrc`, `credentials.json`, `.git`, `node_modules`, `.perfagent` refused       | `packages/security/src/path-guard.ts`                                           |
| Untrusted imports           | 60 MB cap, zod validation, never executed, rendered as text                                                                                                                | `packages/report-schema`, `packages/importers`, `packages/server/src/router.ts` |
| Secret redaction            | API keys, cloud/GitHub/Google/Slack tokens, JWTs, auth headers, private keys, emails, password-like values, secret query parameters; before storage, display, export or AI | `packages/security/src/redact.ts`                                               |
| SSRF guard                  | URL scans refuse private and metadata addresses after DNS resolution; loopback only in local mode                                                                          | `packages/security/src/ssrf.ts`                                                 |
| Your AI, your keys          | No keys or AI server of ours (the optional `ai-proxy` runs locally); keys in the OS keychain or a 0600 file; code sent follows `ai.sendCode` and is redacted; audit log                                                   | `packages/ai`, `ai.*` config                                                    |
| AI output is only a patch   | The AI has no tools that write files, run commands or call the network; writes go through the fixer, on a new branch, after review                                         | `packages/fixer`, `packages/engine/src/services.ts`                             |
| Never pushes                | No code path commits to `main`, pushes, merges, force-pushes, rebases, tags or deploys                                                                                     | `packages/fixer`, `packages/engine/src/git.ts`                                  |
| Production guard            | `NODE_ENV=production` → suggest-only unless `PERFAGENT_FORCE_LOCAL=true`                                                                                                   | `packages/security/src/mode.ts`                                                 |
| Agent snippet               | No cookies, no personal data, sampled, async, fail-silent                                                                                                                  | `packages/agent`                                                                |
| No telemetry                | Nothing is sent to the authors; outbound connections are only the pages you scan and the AI you connect                                                                    | everywhere                                                                      |
| Supply chain                | Committed lockfile, no `postinstall`, `npm publish --provenance`, 2FA, Dependabot, CodeQL, Scorecard                                                                       | `.github/`, `security/CHECKLIST.md`                                             |

## Tests

Security tests live in `packages/security/test` and the server tests: path traversal and symlink escape, origin and host rejection, token mismatch, XSS payloads in imports rendered as text, redaction of tokens and cookies, and the absence of write routes in deployed and static builds. CI runs them on every change.

## Reporting

Please report vulnerabilities privately through GitHub security advisories, as described in [`SECURITY.md`](../SECURITY.md). Do not open a public issue.
