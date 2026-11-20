# PerfAgent self-hosted image.
#
# The server binds to 127.0.0.1 inside the container on purpose (see security/THREAT_MODEL.md), so
# `-p 4545:4545` alone does not expose it. Run it either with `--network host` (dashboard reachable
# on the host's loopback only) or behind a reverse proxy in the same network namespace that adds
# authentication. Mount the project to scan at /project. PERFAGENT_FORCE_LOCAL=true enables local
# mode (file access, fixes on a new branch) when NODE_ENV=production is set; leave it unset for a
# suggest-only instance.

# ---- build ---------------------------------------------------------------------------------------
FROM node:26-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=1
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /src
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY fixtures/demo-shop/package.json ./fixtures/demo-shop/package.json
COPY scripts/package.json ./scripts/package.json
COPY docs ./docs
RUN pnpm install --frozen-lockfile
RUN pnpm build && (pnpm --filter @perfagent/web build || echo "dashboard not built; server serves a placeholder page")
# Production node_modules only, with workspace links resolved into the cli package.
RUN pnpm --filter perfagent --prod deploy /out && cp -r packages/web/dist /out/dashboard 2>/dev/null || true
RUN mkdir -p /out/guides && cp docs/guides/*.md /out/guides/

# ---- runtime -------------------------------------------------------------------------------------
FROM node:26-slim
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PERFAGENT_SERVER_PORT=4545 \
    PERFAGENT_SERVER_OPEN=false

# Google Chrome stable for Playwright channel "chrome" (no 150 MB Playwright browser download).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg fonts-liberation git \
 && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
 && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends google-chrome-stable \
 && apt-get purge -y curl gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 perfagent
WORKDIR /app
COPY --from=build --chown=perfagent:perfagent /out /app
RUN mkdir -p /project && chown perfagent:perfagent /project
USER perfagent
VOLUME ["/project"]
WORKDIR /project

EXPOSE 4545
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["node", "-e", "fetch('http://127.0.0.1:4545/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["node", "/app/dist/bin.js"]
CMD ["--port", "4545", "--no-open"]
