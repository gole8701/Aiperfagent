import type { IncomingMessage, ServerResponse } from 'node:http'

import { PerfAgentError, errorMessage, isPerfAgentError } from '@perfagent/core'

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestContext {
  req: IncomingMessage
  res: ServerResponse
  params: Record<string, string>
  query: URLSearchParams
  /** Reads and JSON-parses the body (limited size). */
  json: <T = unknown>() => Promise<T>
  /** Reads the raw body (for file imports). */
  raw: () => Promise<Buffer>
}

export type Handler = (ctx: RequestContext) => unknown

interface Route {
  method: Method
  pattern: RegExp
  keys: string[]
  handler: Handler
}

const MAX_JSON_BYTES = 5 * 1024 * 1024
const MAX_RAW_BYTES = 64 * 1024 * 1024

/** Small, dependency-free router. Handlers return a value (sent as JSON) or write the response themselves. */
export class Router {
  private readonly routes: Route[] = []

  add(method: Method, path: string, handler: Handler): this {
    const keys: string[] = []
    const pattern = new RegExp(`^${path.replace(/\/:([a-zA-Z]+)/g, (_m, key: string) => { keys.push(key); return '/([^/]+)' })}/?$`)
    this.routes.push({ method, pattern, keys, handler })
    return this
  }

  get(path: string, handler: Handler): this { return this.add('GET', path, handler) }
  post(path: string, handler: Handler): this { return this.add('POST', path, handler) }
  put(path: string, handler: Handler): this { return this.add('PUT', path, handler) }
  delete(path: string, handler: Handler): this { return this.add('DELETE', path, handler) }

  /** Returns false when no route matched. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    for (const route of this.routes) {
      if (route.method !== req.method) continue
      const match = route.pattern.exec(url.pathname)
      if (!match) continue
      const params: Record<string, string> = {}
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1] ?? '') })
      const ctx: RequestContext = { req, res, params, query: url.searchParams, json: () => readJson(req), raw: () => readBody(req, MAX_RAW_BYTES) }
      try {
        const result = await route.handler(ctx)
        if (!res.headersSent && !res.writableEnded) sendJson(res, 200, result ?? { ok: true })
      } catch (error) {
        sendError(res, error)
      }
      return true
    }
    return false
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

export function sendError(res: ServerResponse, error: unknown): void {
  const status = isPerfAgentError(error) ? STATUS[error.code] ?? 400 : 500
  const body = isPerfAgentError(error) ? { error: error.message, code: error.code, hint: error.hint } : { error: errorMessage(error), code: 'INTERNAL' }
  if (!res.headersSent) sendJson(res, status, body)
  else res.end()
}

const STATUS: Partial<Record<PerfAgentError['code'], number>> = { NOT_FOUND: 404, UNAUTHORIZED: 401, ORIGIN_REJECTED: 403, PATH_OUTSIDE_ROOT: 403, NOT_LOCAL_MODE: 403, IMPORT_TOO_LARGE: 413, BROWSER_MISSING: 503, AI_NOT_CONFIGURED: 409 }

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const body = await readBody(req, MAX_JSON_BYTES)
  if (body.length === 0) return {} as T
  try {
    return JSON.parse(body.toString('utf8')) as T
  } catch {
    throw new PerfAgentError('IMPORT_INVALID', 'Request body is not valid JSON')
  }
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        req.destroy()
        reject(new PerfAgentError('IMPORT_TOO_LARGE', `Request body is over ${Math.round(limit / 1_048_576)} MB`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { resolve(Buffer.concat(chunks)) })
    req.on('error', reject)
  })
}
