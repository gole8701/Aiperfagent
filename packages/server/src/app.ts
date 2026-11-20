import { createReadStream } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import path from 'node:path'

import { startLiveSession, launchBrowser, type LiveSession } from '@perfagent/collectors'
import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import { ReportStore, type AiService, type FixService } from '@perfagent/engine'
import {
  createSessionToken,
  detectMode,
  extractToken,
  requestRejection,
  securityHeaders,
  tokenMatches,
  type ModeCheck,
} from '@perfagent/security'

import { AGENT_PATHS, handleAgentRequest } from './agent.js'
import { JobQueue } from './jobs.js'
import { Router, sendError, sendJson } from './router.js'
import { registerRoutes } from './routes/index.js'
import { WsHub } from './ws.js'

export interface ServerOptions {
  config: PerfAgentConfig
  /** Folder with the pre-built dashboard (index.html + assets). */
  dashboardDir?: string
  /** Folder with guide Markdown files. */
  guidesDir?: string
  /** Built real-user agent snippet, served at /agent/perfagent.js. */
  agentScriptPath?: string
  ai?: AiService
  fix?: FixService
  version: string
  /** Static/hosted build: no write routes at all. */
  staticBuild?: boolean
  /** Extra origins allowed (Vite dev server during development). */
  devOrigins?: string[]
}

export interface AppContext extends ServerOptions {
  mode: ModeCheck
  store: ReportStore
  jobs: JobQueue
  hub: WsHub
  token: string
  live: { session?: LiveSession; url?: string }
}

export interface RunningServer {
  url: string
  token: string
  port: number
  mode: ModeCheck
  close: () => Promise<void>
}

const HOST = '127.0.0.1'

export async function createServer(options: ServerOptions): Promise<RunningServer> {
  const token = createSessionToken()
  const mode = await detectMode({
    root: options.config.root,
    bindHost: HOST,
    staticBuild: options.staticBuild,
  })
  const store = new ReportStore(options.config.root)
  await store.init()
  const port = options.config.server.port
  const policy = { port, extraOrigins: options.devOrigins }
  const router = new Router()

  const http: Server = createHttpServer((req, res) => {
    void handle(req, res)
  })
  const hub = new WsHub(http, token, policy, mode.mode)
  const ctx: AppContext = { ...options, mode, store, jobs: new JobQueue(), hub, token, live: {} }
  registerRoutes(router, ctx)

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [k, v] of Object.entries(
      securityHeaders({ dev: Boolean(options.devOrigins?.length) }),
    ))
      res.setHeader(k, v)
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    // The only exception to the Host/Origin rejection: the public snippet and its collector, which are called from the user's own site (see agent.ts).
    if (AGENT_PATHS.includes(pathname)) {
      await handleAgentRequest(req, res, pathname, ctx)
      return
    }
    const rejection = requestRejection(req.headers as Record<string, string | undefined>, policy)
    if (rejection) {
      sendError(res, new PerfAgentError('ORIGIN_REJECTED', rejection))
      return
    }
    const url = req.url ?? '/'
    if (url.startsWith('/api/')) {
      if (!tokenMatches(token, extractToken(req.headers, url))) {
        sendError(
          res,
          new PerfAgentError(
            'UNAUTHORIZED',
            'Missing or wrong token.',
            'Open the dashboard from the URL printed in the terminal.',
          ),
        )
        return
      }
      const handled = await router.handle(req, res)
      if (!handled) sendJson(res, 404, { error: 'No such route', code: 'NOT_FOUND' })
      return
    }
    await serveDashboard(req, res, url, options.dashboardDir)
  }

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject)
    http.listen(port, HOST, resolve)
  })

  const url = `http://${HOST}:${port}/?token=${token}`
  // Lets `perfagent mcp` (open_dashboard) find the running dashboard.
  await store
    .writeJson('server.json', { url, port, pid: process.pid, startedAt: new Date().toISOString() })
    .catch(() => undefined)

  return {
    url,
    token,
    port,
    mode,
    close: async () => {
      await rm(path.join(store.dir, 'server.json'), { force: true }).catch(() => undefined)
      await ctx.live.session?.stop().catch(() => undefined)
      hub.close()
      await new Promise<void>((resolve) => http.close(() => resolve()))
    },
  }
}

/** Serves the built dashboard. Unknown paths fall back to index.html (client-side routing). */
async function serveDashboard(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  dir: string | undefined,
): Promise<void> {
  if (!dir) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<!doctype html><title>PerfAgent</title><p style="font:16px system-ui;padding:40px">PerfAgent server is running. The dashboard is not built yet; run <code>pnpm --filter @perfagent/web build</code>.</p>',
    )
    return
  }
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname)
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let file = path.join(dir, safe)
  if (!file.startsWith(dir)) file = path.join(dir, 'index.html')
  const info = await stat(file).catch(() => undefined)
  if (!info?.isFile()) file = path.join(dir, 'index.html')
  const ext = path.extname(file)
  const type = MIME[ext] ?? 'application/octet-stream'
  const cache = ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable'
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache })
  createReadStream(file).pipe(res)
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.md': 'text/markdown; charset=utf-8',
}

export { startLiveSession, launchBrowser }
