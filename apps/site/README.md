# PerfAgent website (`apps/site`)

The public static site: landing page with the three promises, install command, feature grid, a "Quick test any URL" box that calls the PageSpeed Insights API from the visitor's browser, the docs rendered from `docs/`, and the static demo dashboard under `/app/`. Plain HTML + CSS + a few lines of JavaScript; no framework. Nothing here can scan, write or call AI; the only network call is the visitor's own PageSpeed request.

## Build

```bash
pnpm --filter perfagent-site build     # → apps/site/dist
pnpm --filter perfagent-site preview   # http://localhost:8080
```

`build.mjs` does, in order:

1. Copies `index.html` and `site.css` to `dist/`.
2. Copies `packages/web/dist-static` (the dashboard's static build, when it exists) to `dist/app/`; otherwise writes a placeholder page there. The root build does not produce `dist-static` yet; once the web package has a `build:static` script, run it before this build (the `site.yml` workflow tries it and continues without it).
3. Renders every `docs/guides/*.md` to `dist/docs/guide-<topic>.html` (the `walkthrough` JSON block becomes a numbered list), copies the raw `.md` files to `dist/guides/` and writes `dist/guides/index.json` (front matter: topic, title, group, summary, order, tryIt, metric) so the static dashboard can load the guides without a server.
4. Renders every `docs/*.md` to `dist/docs/<name>.html` and writes `dist/docs/index.html`.

Markdown is rendered with `marked` (exact version in `package.json`). The output is not sanitised because the input is our own documentation in this repository; `DOMPurify` is browser-only and would not run at build time. Never pass user content through this build.

## Deploy (all free)

The output is `apps/site/dist`, a folder of static files. Build command for every host: `pnpm install --frozen-lockfile && pnpm build && pnpm --filter perfagent-site build`.

**GitHub Pages** (configured): `.github/workflows/site.yml` builds on every push to `main` and deploys with `actions/deploy-pages`. In the repository settings set _Pages → Source → GitHub Actions_ once. The site appears at `https://<owner>.github.io/perfagent/`; links in the site are relative, so a sub-path works.

**Vercel**: import the repository, framework preset _Other_, root directory `.`, build command as above, output directory `apps/site/dist`, install command `pnpm install --frozen-lockfile`. Node 22.

**Netlify**: `netlify.toml` or UI: base `.`, build command as above, publish directory `apps/site/dist`. Set `NODE_VERSION=22` in the environment.

**Cloudflare Pages**: connect the repository, build command as above, output `apps/site/dist`, environment variable `NODE_VERSION=22`.

A custom domain (for example `perfagent.dev`) is optional; the free sub-domains work as is.

## Quick test

The box posts nothing to us. It calls `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile` directly from the browser, reads the performance score, LCP and CLS from the Lighthouse result and INP (p75) from the Chrome UX Report field data when present, rates them with the same thresholds as `packages/core/src/metrics.ts`, and writes the plain-language sentences. Google's free quota applies per IP; errors are shown in the status line.
