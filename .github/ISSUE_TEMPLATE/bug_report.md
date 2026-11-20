---
name: Bug report
about: Something does not work as the docs say
title: ''
labels: bug
assignees: ''
---

**What happened**
A clear sentence. If PerfAgent printed an error, paste the message and the hint.

**What you expected**

**Steps to reproduce**

1. `npx perfagent …`
2. Click …
3. See …

If the problem is a wrong or missing finding, attach the report: `npx perfagent export latest --format json --out report.json` (reports are redacted, but check it before attaching).

**Environment**

- PerfAgent version (`npx perfagent --version`):
- Node version (`node --version`):
- OS:
- Browser used for scans (Chrome / Edge / Playwright Chromium):
- Framework of the scanned project (React, Next.js, Vue, plain HTML…):
- Mode shown at start (`local` or `suggest-only: …`):

**Config**
Relevant parts of `perfagent.config.ts` (no keys are in it, but remove internal URLs if needed).

**Security**
If this is a security problem (reading files outside the project, another origin reaching the server, writes outside local mode), do not file it here; use a private security advisory (see SECURITY.md).
