import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { PerfAgentError } from '@perfagent/core'

import {
  errorInfo,
  modelOf,
  providerForUrl,
  Recorder,
  usageOf,
  type Sample,
} from './watch/recorder.js'

export interface AiProxyOptions {
  /** Provider base URL, e.g. `https://api.openai.com` or `https://api.anthropic.com`. */
  targetBaseUrl: string
  port: number
  /** Samples file; defaults to `<cwd>/.perfagent/ai-samples.jsonl`. */
  file?: string
  logPrompts?: boolean
}

export interface RunningAiProxy {
  url: string
  port: number
  close: () => Promise<void>
}

const HOST = '127.0.0.1'
const UPSTREAM_TIMEOUT_MS = 10 * 60_000
const MAX_BODY = 20 * 1024 * 1024
const HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'accept-encoding',
])

/**
 * Dev-only measuring proxy: point `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` at
 * it and every call is recorded with zero code change. Keys pass straight
 * through to the provider and are never written anywhere.
 */
export async function createAiProxy(options: AiProxyOptions): Promise<RunningAiProxy> {
  const target = new URL(options.targetBaseUrl)
  if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname))
    throw new PerfAgentError('CONFIG_INVALID', 'The AI proxy target must be https (or localhost).')
  const provider = providerForUrl(target.host) ?? 'openai-compatible'
  const recorder = new Recorder({ file: options.file, logPrompts: options.logPrompts })

  const server: Server = createServer((req, res) => {
    void forward(req, res).catch((error: unknown) => {
      if (!res.headersSent) res.writeHead(502)
      res.end(errorInfo(error))
    })
  })

  async function forward(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = performance.now()
    const body = await readBody(req)
    const bodyText = body.toString('utf8')
    const parsed = safeParse(bodyText)
    const streaming = parsed?.stream === true
    const sample: Sample = {
      at: new Date().toISOString(),
      model: modelOf(parsed, 'unknown'),
      provider,
      firstTokenMs: 0,
      totalMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      costUsd: 0,
      retries: 0,
      stalls: 0,
      path: req.url,
      prompt: options.logPrompts ? bodyText.slice(0, 20_000) : undefined,
    }
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers))
      if (!HOP_HEADERS.has(k) && typeof v === 'string') headers[k] = v
    let upstream: Response
    try {
      upstream = await fetch(new URL(req.url ?? '/', target), {
        method: req.method,
        headers,
        body: body.length ? body : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        redirect: 'manual',
      })
    } catch (error) {
      sample.error = errorInfo(error)
      finish(sample, started)
      res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('PerfAgent proxy could not reach the provider')
      return
    }
    const out: Record<string, string> = {}
    upstream.headers.forEach((v, k) => {
      if (!HOP_HEADERS.has(k)) out[k] = v
    })
    res.writeHead(upstream.status, out)
    if (!upstream.ok) sample.error = String(upstream.status)
    if (!upstream.body) {
      finish(sample, started)
      res.end()
      return
    }
    const reader = (upstream.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    let text = ''
    let last = started
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const t = performance.now()
        // TTFT = first streamed byte for streaming calls; the whole body otherwise.
        if (!sample.firstTokenMs && streaming) sample.firstTokenMs = Math.round(t - started)
        else if (t - last > 1000) sample.stalls++
        last = t
        if (text.length < 500_000) text += decoder.decode(value, { stream: true })
        if (!res.write(value)) await new Promise<void>((resolve) => res.once('drain', resolve))
      }
    } catch (error) {
      sample.error = errorInfo(error)
    }
    res.end()
    for (const line of text.split('\n')) {
      const json = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
      if (!json.startsWith('{')) continue
      const chunk = safeParse(json)
      const usage = usageOf(chunk)
      if (usage?.input || usage?.output)
        Object.assign(sample, {
          inputTokens: usage.input || sample.inputTokens,
          outputTokens: usage.output || sample.outputTokens,
          cachedTokens: usage.cached || sample.cachedTokens,
        })
      sample.model = modelOf(chunk, sample.model)
    }
    if (options.logPrompts) sample.answer = text.slice(0, 20_000)
    finish(sample, started)
  }

  function finish(sample: Sample, started: number): void {
    sample.totalMs = Math.round(performance.now() - started)
    if (!sample.firstTokenMs) sample.firstTokenMs = sample.totalMs
    recorder.record(sample)
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, HOST, resolve)
  })
  const port = (server.address() as { port: number }).port
  return {
    url: `http://${HOST}:${port}`,
    port,
    close: () =>
      new Promise((resolve) => {
        recorder.flush()
        server.close(() => resolve())
      }),
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new Error('Request body too large'))
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    req.on('error', reject)
  })
}

function safeParse(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}
