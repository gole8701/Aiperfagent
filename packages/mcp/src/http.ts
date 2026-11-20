import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'

import { buildMcpServer } from './tools.js'

import type { McpServerOptions } from './index.js'

const DEFAULT_PORT = 4546
const MAX_BODY = 4 * 1024 * 1024

/**
 * Streamable HTTP for ChatGPT connectors and teams. One session per client,
 * every request needs the bearer token. Full OAuth is out of scope; the 401
 * carries `WWW-Authenticate` so OAuth-capable clients know a token is required.
 */
export async function startHttpTransport(options: McpServerOptions): Promise<void> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? DEFAULT_PORT
  const fromEnv = process.env.PERFAGENT_MCP_TOKEN
  const token =
    fromEnv !== undefined && fromEnv !== '' ? fromEnv : randomBytes(24).toString('base64url')
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${host}`)
    if (url.pathname !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    if (!authorised(req.headers.authorization, token)) {
      res.writeHead(401, {
        'WWW-Authenticate':
          'Bearer realm="perfagent", error="invalid_token", error_description="Set Authorization: Bearer <PERFAGENT_MCP_TOKEN>"',
        'content-type': 'application/json',
      })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    const sessionId = req.headers['mcp-session-id']
    const existing = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined
    if (existing) {
      await existing.handleRequest(req, res)
      return
    }
    const body: unknown = req.method === 'POST' ? await readJson(req) : undefined
    if (req.method !== 'POST' || !isInitializeRequest(body)) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Send an initialize request first' }))
      return
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport)
      },
    })
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId)
    }
    await buildMcpServer(options).connect(transport)
    await transport.handleRequest(req, res, body)
  }

  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, resolve)
  })
  process.stderr.write(
    `PerfAgent MCP server ready at http://${host}:${port}/mcp (${options.allowWrites ? 'writes enabled' : 'read-only'})\n`,
  )
  process.stderr.write(
    process.env.PERFAGENT_MCP_TOKEN
      ? 'Token: from PERFAGENT_MCP_TOKEN\n'
      : `Token (send as "Authorization: Bearer …"): ${token}\n`,
  )
  if (host !== '127.0.0.1')
    process.stderr.write(
      'Warning: listening on all interfaces; anyone with the token can read your reports.\n',
    )
  await new Promise<void>((resolve) => {
    server.once('close', resolve)
  })
}

function authorised(header: string | undefined, token: string): boolean {
  const given = header?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new Error('Body too large'))
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined)
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', reject)
  })
}
