# FAQ

**Does PerfAgent send my code anywhere?**
No. The dashboard runs on your machine at `127.0.0.1` and stores everything in `.perfagent/` inside your project. There is no telemetry. The only outbound connections are the pages you scan and, if you connect one, the AI provider you chose. How much code goes to that provider is set by `ai.sendCode` (`snippets` by default, `none` to send nothing), and it is redacted first.

**Who pays for AI?**
You, with your own key, company endpoint or assistant subscription, or nobody if you use a free local model through Ollama. PerfAgent ships with no API keys and no AI server. Without any AI connected it still finds problems and gives built-in fixes with its rule engine.

**Can it change my production site?**
Never. Code changes happen only in local mode (loopback, a git repository, `NODE_ENV` not production), on a new branch `perfagent/fix-<date>`, after your review. A deployed or hosted PerfAgent has no write routes at all. PerfAgent never pushes, merges or deploys; you do.

**Does it work with Vue, Angular, Svelte or plain HTML?**
Measuring: yes. Pages are measured from the outside in a real browser, whatever they are built with, and the general, realtime, AI and agents rule packs apply to any project. File:line root causes: for JavaScript/TypeScript projects. Framework-specific rules: React and Next.js today; Vue/Nuxt, Angular and Svelte packs are planned.

**Does it use Lighthouse?**
It uses Playwright and the Chrome DevTools Protocol directly, with the same device profiles and a Lighthouse-style weighted score, so numbers are comparable with PageSpeed Insights. Lighthouse and PageSpeed JSON files can be imported.

**Highcharts?**
No. Charts are Apache ECharts (Apache-2.0), imported modularly. Highcharts needs a commercial licence.

**Which browser does it need?**
The Google Chrome or Edge already on your machine, through Playwright. If none is found, `npx playwright install chromium` downloads one. Firefox and WebKit can be selected with `browser` in the config but have fewer signals (no CDP coverage or filmstrip).

**Why does it say "suggest-only"?**
One of the local-mode checks failed. The reasons are printed at start and shown in Settings: not a git repository, `NODE_ENV=production`, not bound to loopback, or the hosted/static build. Fix the reason (for example `git init`) or, for `NODE_ENV`, set `PERFAGENT_FORCE_LOCAL=true` on purpose.

**Where are my API keys stored?**
In your operating system's keychain (macOS Keychain, Windows Credential Manager, libsecret on Linux), never in `perfagent.config.ts` or `.perfagent/`. The dashboard shows them masked.

**Can I use it in CI?**
Yes: `npx perfagent ci` scans, checks the `budgets` in your config and exits 1 when a limit is broken. `--comment file.md` writes a pull-request comment. See the Budgets in CI guide and `.github/workflows/perfagent-example.yml`.

**Can I use it from Claude Code, Cursor or Copilot?**
Yes, as an MCP server: `npx perfagent mcp`. See `docs/mcp.md`.

**What licence is it?**
MIT for everything in this repository. Paid hosted features (team history, real-user collection, tests from many locations) are planned in a separate repository under a different licence; nothing in the MIT core depends on them.

**How do I uninstall it?**
`npm uninstall perfagent`, then delete `perfagent.config.ts` and the `.perfagent/` folder. Remove the API keys from your keychain through Settings → AI before uninstalling, or delete the `perfagent` entries in your keychain app. Nothing else is left behind.

**It is slow on my machine.**
Scans run a throttled mobile profile (4× CPU slowdown) three times per page by design. Use `--runs 1` for a quick look, `--device desktop` for no throttling, or `--no-project` to skip reading source files.
