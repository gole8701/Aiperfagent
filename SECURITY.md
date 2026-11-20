# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub security advisories: open the repository's **Security** tab → **Report a vulnerability** (https://github.com/gole8701/perfagent/security/advisories/new). Do not open a public issue or pull request for a vulnerability.

Include what you found, how to reproduce it, which version, and what an attacker could do. You will get an acknowledgement within 3 working days and a fix or a plan within 14 days for anything that lets an attacker read files outside the project, run commands, reach the server from another origin, or make PerfAgent write code outside local mode. Credit is given in the release notes unless you prefer not to be named.

## Supported versions

| Version                               | Supported                                    |
| ------------------------------------- | -------------------------------------------- |
| latest minor on npm (`perfagent@0.x`) | yes                                          |
| older                                 | no; upgrade with `npm i -D perfagent@latest` |

## Scope

In scope: the `perfagent` npm package and every `@perfagent/*` package in this repository, the local server and dashboard, the CLI, the MCP server, the real-user agent snippet, the Docker image and the static website build.

Out of scope: the sites you scan, the AI providers you connect, your editor, third-party dependencies (report those upstream; we will update), and findings that need an attacker already running code as your user on your machine.

## The promises

PerfAgent is built so that it has no ability to do dangerous things, and a report that shows one of these promises broken is a vulnerability:

1. The server listens on `127.0.0.1` only.
2. Every request needs the per-start random token; requests from other origins or hosts are rejected.
3. Read-only by default: no endpoint changes project files outside local mode, and a deployed or static build has no write routes at all.
4. No endpoint runs user-supplied commands or code; editor and git commands use fixed argument arrays.
5. Only files inside the project root can be read or opened; `.env*`, keys, `.git`, `node_modules` and `.perfagent` never.
6. Imports are size-limited, schema-validated, never executed, and rendered as text.
7. Secrets are redacted before storage, display, export or AI.
8. AI output is only ever a proposed patch; the AI has no tools that write files, run commands or call the network. Writes go to a new branch after review. PerfAgent never pushes, merges or deploys.
9. API keys live in the OS keychain and go only to their provider.
10. No telemetry.
11. Supply chain: committed lockfile, no `postinstall` scripts, `npm publish --provenance`, 2FA on npm and GitHub, Dependabot, CodeQL.

Full threat model: [security/THREAT_MODEL.md](security/THREAT_MODEL.md). Release checklist: [security/CHECKLIST.md](security/CHECKLIST.md).
