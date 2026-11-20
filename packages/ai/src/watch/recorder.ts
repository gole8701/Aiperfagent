import type { AiCallSample } from '@perfagent/core'

import { estimateCostUsd } from '../prices.js'

/*
 * Runs inside the user's app, possibly on an Edge runtime: no Node imports at
 * module level, nothing here may throw into the caller, and the hot path must
 * stay microseconds.
 */

export interface RecorderOptions {
  /** JSON-lines file; defaults to `<cwd>/.perfagent/ai-samples.jsonl` in Node. */
  file?: string
  /** POST batches here instead of (or as well as) the file. */
  endpoint?: string
  /** Keep prompts and answers; off by default. */
  logPrompts?: boolean
  route?: string
  flushMs?: number
  /** Test hook: receives every sample synchronously. */
  onSample?: (sample: AiCallSample) => void
}

export type Sample = AiCallSample & { path?: string; prompt?: string; answer?: string }

interface Usage {
  input: number
  output: number
  cached: number
}

const AI_HOSTS: [string, string][] = [
  ['api.anthropic.com', 'anthropic'],
  ['api.openai.com', 'openai'],
  ['generativelanguage.googleapis.com', 'gemini'],
  ['openai.azure.com', 'openai-compatible'],
  ['api.groq.com', 'openai-compatible'],
  ['openrouter.ai', 'openai-compatible'],
  ['api.deepseek.com', 'openai-compatible'],
  ['api.mistral.ai', 'openai-compatible'],
  ['localhost:11434', 'ollama'],
  ['127.0.0.1:11434', 'ollama'],
]

export function providerForUrl(url: string): string | undefined {
  return AI_HOSTS.find(([host]) => url.includes(host))?.[1]
}

export function providerForPath(path: string): string {
  if (path.startsWith('messages.')) return 'anthropic'
  if (path.startsWith('chat.') || path.startsWith('responses.') || path.startsWith('embeddings.'))
    return 'openai'
  if (path.startsWith('models.')) return 'gemini'
  return 'unknown'
}

/** Reads token counts from any SDK's usage object (Anthropic, OpenAI chat/responses, Gemini, Ollama). */
export function usageOf(value: unknown): Usage | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  const raw = (v.usage ??
    v.usageMetadata ??
    (v.response as Record<string, unknown> | undefined)?.usage ??
    (v.message as Record<string, unknown> | undefined)?.usage) as
    | Record<string, unknown>
    | undefined
  if (raw) {
    const n = (k: string): number => {
      const v = raw[k]
      return typeof v === 'number' ? v : 0
    }
    const details = (k: string): Record<string, unknown> =>
      typeof raw[k] === 'object' && raw[k] ? (raw[k] as Record<string, unknown>) : {}
    const cached =
      n('cache_read_input_tokens') ||
      n('cachedContentTokenCount') ||
      Number(details('prompt_tokens_details').cached_tokens ?? 0) ||
      Number(details('input_tokens_details').cached_tokens ?? 0)
    return {
      input: n('input_tokens') || n('prompt_tokens') || n('promptTokenCount') || n('promptTokens'),
      output:
        n('output_tokens') ||
        n('completion_tokens') ||
        n('candidatesTokenCount') ||
        n('completionTokens'),
      cached,
    }
  }
  if (typeof v.prompt_eval_count === 'number' || typeof v.eval_count === 'number')
    return { input: Number(v.prompt_eval_count ?? 0), output: Number(v.eval_count ?? 0), cached: 0 }
  return undefined
}

export function modelOf(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback
  const v = value as Record<string, unknown>
  const model =
    v.model ??
    v.modelVersion ??
    (v.response as Record<string, unknown> | undefined)?.model ??
    (v.message as Record<string, unknown> | undefined)?.model
  return typeof model === 'string' ? model : fallback
}

export function errorInfo(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { status?: unknown; name?: unknown; message?: unknown }
    if (typeof e.status === 'number') return String(e.status)
    if (e.name === 'AbortError' || e.name === 'TimeoutError') return 'timeout'
    if (typeof e.message === 'string') return e.message.slice(0, 120)
  }
  return 'error'
}

/** Batches samples and flushes every 2 s, on exit, and when the batch is full. All I/O is fire-and-forget. */
export class Recorder {
  private batch: Sample[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private lastErrorAt = new Map<string, number>()
  private appendFile:
    | Promise<((file: string, data: string) => Promise<void>) | undefined>
    | undefined

  constructor(readonly options: RecorderOptions) {
    const proc = (globalThis as { process?: { on?: (event: string, cb: () => void) => void } })
      .process
    try {
      proc?.on?.('beforeExit', () => {
        this.flush()
      })
      proc?.on?.('exit', () => {
        this.flush()
      })
    } catch {
      // Not Node: no exit hook, the interval flush covers it.
    }
  }

  /** Retries = calls on the same path that start within 2 s of a previous failure. */
  retriesFor(path: string, now: number): number {
    const last = this.lastErrorAt.get(path)
    return last !== undefined && now - last < 2000 ? 1 : 0
  }

  noteError(path: string, now: number): void {
    this.lastErrorAt.set(path, now)
  }

  record(sample: Sample): void {
    try {
      sample.costUsd = estimateCostUsd(
        sample.model,
        sample.inputTokens,
        sample.outputTokens,
        sample.cachedTokens,
        sample.provider,
      )
      if (!this.options.logPrompts) {
        delete sample.prompt
        delete sample.answer
      }
      this.options.onSample?.(sample)
      this.batch.push(sample)
      if (this.batch.length >= 200) this.flush()
      else
        this.timer ??= setTimeoutUnref(() => {
          this.flush()
        }, this.options.flushMs ?? 2000)
    } catch {
      // Never into the user's app.
    }
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    if (!this.batch.length) return
    const lines = this.batch
    this.batch = []
    const text = `${lines.map((s) => JSON.stringify(s)).join('\n')}\n`
    void this.write(text, lines).catch(() => undefined)
  }

  private async write(text: string, lines: Sample[]): Promise<void> {
    if (this.options.endpoint) {
      await fetch(this.options.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lines),
        signal: AbortSignal.timeout(3000),
      }).catch(() => undefined)
      if (!this.options.file) return
    }
    const append = await this.fs()
    if (!append) return
    const file =
      this.options.file ??
      `${(globalThis as { process?: { cwd?: () => string } }).process?.cwd?.() ?? '.'}/.perfagent/ai-samples.jsonl`
    await append(file, text)
  }

  private fs(): Promise<((file: string, data: string) => Promise<void>) | undefined> {
    this.appendFile ??= Promise.all([import('node:fs/promises'), import('node:path')])
      .then(([fs, pathMod]) => async (file: string, data: string) => {
        await fs.mkdir(pathMod.dirname(file), { recursive: true })
        await fs.appendFile(file, data, 'utf8')
      })
      .catch(() => undefined)
    return this.appendFile
  }
}

function setTimeoutUnref(cb: () => void, ms: number): ReturnType<typeof setTimeout> {
  const t = setTimeout(cb, ms)
  ;(t as { unref?: () => void }).unref?.()
  return t
}
