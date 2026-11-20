import { createReadStream } from 'node:fs'
import { appendFile, readFile, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

import { PerfAgentError } from '@perfagent/core'
import { redact } from '@perfagent/security'
import { z } from 'zod'

import type { AppContext } from './app.js'
import { sendError, sendJson } from './router.js'

/*
 * The real-user snippet posts here from the user's own site, so these two
 * paths are the only ones that bypass the dashboard's Host/Origin rejection:
 * the script is public and static; the collector allows only the configured
 * site origins, takes no token, no cookies and a 256 KB body.
 */
export const AGENT_PATHS = ['/agent/perfagent.js', '/agent/collect']

const MAX_BODY = 256 * 1024
const MAX_EVENTS = 500
const RUM_FILE = 'rum.jsonl'
const RUM_KEEP_LINES = 50_000

const eventSchema = z
  .object({
    t: z.enum(['vital', 'req', 'ai', 'ws', 'task', 'err', 'mem', 'nav']),
    at: z.number(),
    route: z.string().max(500),
    name: z.string().max(40).optional(),
    value: z.number().optional(),
    target: z.string().max(200).optional(),
    type: z.string().max(40).optional(),
    url: z.string().max(2000).optional(),
    method: z.string().max(10).optional(),
    status: z.number().optional(),
    ms: z.number().optional(),
    size: z.number().optional(),
    firstTokenMs: z.number().optional(),
    model: z.string().max(100).optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    kind: z.string().max(20).optional(),
    in: z.number().optional(),
    inBytes: z.number().optional(),
    out: z.number().optional(),
    outBytes: z.number().optional(),
    reconnects: z.number().optional(),
    code: z.number().optional(),
    message: z.string().max(300).optional(),
    frame: z.string().max(300).optional(),
    mb: z.number().optional(),
    to: z.string().max(500).optional(),
    error: z.string().max(100).optional(),
  })
  .strip()

export type AgentEvent = z.infer<typeof eventSchema>

export function allowedAgentOrigins(config: AppContext['config']): Set<string> {
  const origins = new Set<string>()
  for (const url of [...config.urls, ...Object.values(config.environments).map((e) => e.url)]) {
    try {
      origins.add(new URL(url).origin)
    } catch {
      // Config validation already rejects bad URLs; nothing to add.
    }
  }
  return origins
}

export async function handleAgentRequest(req: IncomingMessage, res: ServerResponse, pathname: string, ctx: AppContext): Promise<void> {
  if (pathname === '/agent/perfagent.js') {
    await serveScript(req, res, ctx.agentScriptPath)
    return
  }
  const origin = req.headers.origin
  const allowed = origin !== undefined && allowedAgentOrigins(ctx.config).has(origin)
  if (req.method === 'OPTIONS') {
    if (allowed) res.writeHead(204, { ...cors(origin), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '600' })
    else res.writeHead(403)
    res.end()
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end()
    return
  }
  if (!allowed) {
    sendError(res, new PerfAgentError('ORIGIN_REJECTED', 'This site is not in config.urls or config.environments', 'Add the site URL to perfagent.config to accept its real-user data.'))
    return
  }
  for (const [k, v] of Object.entries(cors(origin))) res.setHeader(k, v)
  let events: AgentEvent[]
  try {
    events = parseEvents(await readBody(req))
  } catch (error) {
    sendError(res, error)
    return
  }
  for (const event of events) ctx.hub.broadcast({ type: 'live:tick', tick: { source: 'agent', ...event } })
  await appendRum(ctx.store.dir, events)
  sendJson(res, 200, { received: events.length })
}

function cors(origin: string): Record<string, string> {
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
}

function parseEvents(body: Buffer): AgentEvent[] {
  let raw: unknown
  try {
    raw = JSON.parse(body.toString('utf8'))
  } catch {
    throw new PerfAgentError('IMPORT_INVALID', 'Agent batch is not valid JSON')
  }
  const list = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null && Array.isArray((raw as { events?: unknown }).events) ? ((raw as { events: unknown[] }).events) : undefined
  if (!list) throw new PerfAgentError('IMPORT_INVALID', 'Agent batch must be a JSON array of events')
  const events: AgentEvent[] = []
  for (const item of list.slice(0, MAX_EVENTS)) {
    const parsed = eventSchema.safeParse(item)
    if (parsed.success) events.push(redact(parsed.data))
  }
  return events
}

async function appendRum(dir: string, events: AgentEvent[]): Promise<void> {
  if (!events.length) return
  const file = path.join(dir, RUM_FILE)
  await appendFile(file, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8')
  const info = await stat(file).catch(() => undefined)
  // ~200 bytes per line; trim only when the file is clearly past the limit.
  if (info && info.size > RUM_KEEP_LINES * 300) {
    const lines = (await readFile(file, 'utf8')).split('\n')
    await writeFile(file, `${lines.slice(-RUM_KEEP_LINES).join('\n').trimEnd()}\n`, 'utf8')
  }
}

async function serveScript(req: IncomingMessage, res: ServerResponse, file: string | undefined): Promise<void> {
  if (req.method !== 'GET' || !file || !(await stat(file).catch(() => undefined))?.isFile()) {
    sendJson(res, 404, { error: 'The agent script is not built', code: 'NOT_FOUND' })
    return
  }
  // A public static script: a wildcard origin is fine here (and needed for crossorigin/SRI loads).
  res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' })
  createReadStream(file).pipe(res)
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new PerfAgentError('IMPORT_TOO_LARGE', 'Agent batch is over 256 KB'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { resolve(Buffer.concat(chunks)) })
    req.on('error', reject)
  })
}
