---
title: Security & local mode
group: Settings
summary: Local only, a secret token, read-only by default, writes only on a new branch in local mode, no telemetry, your keys in your keychain.
order: 30
tryIt: /settings/display
---

## What it is

PerfAgent is designed so that it has no ability to do dangerous things, rather than promising it will not.

The dashboard listens on `127.0.0.1` only, needs a fresh random token on every start, rejects requests from other websites, never runs user-supplied commands, only reads files inside your project, and writes code only in local mode, on a new git branch, after your review. It sends nothing to its authors.

## Why it matters

A tool that reads your source code and talks to AI models needs to be trustworthy by construction. A bug, a malicious imported file or a prompt injection should have nothing to abuse.

## Use case

- A security review before adopting PerfAgent in a company.
- Understanding why the Apply button is hidden ("suggest-only").
- Checking what leaves the machine when AI is connected.

## How it helps your app

You can run it on real projects with real keys without new risk: keys stay in the OS keychain, imports are validated and shown as text, secrets are redacted before storage, display, export or AI, and write features do not exist in deployed or hosted builds.

## How to do it in PerfAgent, step by step

1. **Terminal:** read the mode line printed at start: `local (can open files and apply fixes)` or `suggest-only: <reasons>`.
2. **Settings:** the same mode and its reasons are shown at the top of **Settings**, with the capabilities list (scan project, open editor, apply fixes, AI, live).
3. **Settings:** keep `ai.redact` and `ai.auditLog` on; set `ai.sendCode` to `none` if no code may leave the machine.
4. **Settings:** add `fix.protected` globs for paths the AI may never edit (payments, auth, infrastructure).
5. **Terminal:** open `.perfagent/audit.log` to see what was sent to which AI and which fix runs created which branches.

## Commands & config

```bash
# Local mode needs all of: loopback bind, a git repository, NODE_ENV != production, not the static build
NODE_ENV=production npx perfagent            # → suggest-only
PERFAGENT_FORCE_LOCAL=true npx perfagent     # override the NODE_ENV check on purpose
```

```ts
export default defineConfig({
  ai: { sendCode: 'snippets', redact: true, auditLog: true },
  fix: {
    review: true,
    autoCommit: false,
    protected: ['src/payments/**', 'infra/**'],
  },
})
```

## Expert detail

- Principles and where they live (`packages/security/src`): `token.ts` (32 random bytes per start, constant-time comparison, accepted as `Authorization: Bearer`, `?token=` or the `perfagent_token` cookie); `origin-check.ts` (Host must be loopback on the server port; Origin, when present, must match; `Sec-Fetch-Site: cross-site` without Origin is rejected); `csp.ts` (`default-src 'self'`, scripts only from self plus `wasm-unsafe-eval`, `connect-src` limited to the local server and localhost ports, `frame-ancestors 'none'`, `nosniff`, `no-referrer`, COOP/CORP); `path-guard.ts` (realpath inside root, symlink escape blocked, `.env*`, keys, `.npmrc`, `.netrc`, `credentials.json`, `.git`, `node_modules`, `.perfagent` refused); `redact.ts` (API keys, AWS/GitHub/Google/Slack tokens, JWTs, Bearer/Basic headers, private keys, emails, `password=`-style values, secret headers and query parameters); `ssrf.ts` (private and metadata addresses refused for URL scans; loopback only in local mode); `mode.ts` (local vs suggest-only).
- Write routes (`/api/editor/*`, `/api/files/snippet`, `/api/fix/*`) are registered only when `mode === 'local'` and not in the static build (`packages/server/src/routes/index.ts`); a deployed build has no code path that writes.
- Editor and git commands use `execFile` with fixed argument arrays, never shell strings.
- Imports: 60 MB cap, zod validation, never executed, rendered as text; React escaping and the CSP block script injection from imported data.
- AI: the user's own key or a local model; page and file content is data, never instructions; the AI has no tools that write files, run commands or call the network. Output is a proposed patch, applied only after review.
- Supply chain: a committed lockfile, no `postinstall` scripts, `npm publish --provenance`, 2FA, Dependabot, CodeQL and an OpenSSF Scorecard. See `SECURITY.md` and `security/THREAT_MODEL.md` in the repository.
- No telemetry of any kind. The only outbound connections are the ones you configure: the pages you scan and the AI provider you connect.

## Walkthrough

```walkthrough
[
  { "screen": "terminal", "area": "command", "title": "Token and mode", "text": "Dashboard: http://127.0.0.1:4545/?token=… · Mode: local (can open files and apply fixes)." },
  { "screen": "settings", "area": "mode-banner", "title": "Why suggest-only?", "text": "The reasons are listed: not a git repository, NODE_ENV is production, hosted build." },
  { "screen": "settings", "area": "limits", "title": "What leaves the machine", "text": "sendCode, redaction and the audit log control and record every AI call." },
  { "screen": "settings", "area": "protected", "title": "Protected paths", "text": "Globs the AI may never edit, such as src/payments/**." }
]
```

## Learn more

- [OWASP: Server-Side Request Forgery](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP)
- [OWASP: Top 10 for LLM applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [npm: Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements)
