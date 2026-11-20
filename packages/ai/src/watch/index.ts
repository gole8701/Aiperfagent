import type { AiCallSample } from '@perfagent/core'

import {
  errorInfo,
  modelOf,
  providerForPath,
  providerForUrl,
  Recorder,
  usageOf,
  type RecorderOptions,
  type Sample,
} from './recorder.js'

export type WatchOptions = RecorderOptions

const WATCHED = new Set([
  'messages.create',
  'messages.stream',
  'chat.completions.create',
  'responses.create',
  'models.generateContent',
  'models.generateContentStream',
  'embeddings.create',
])
const STALL_MS = 1000
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// Route context (withRoute) and agent steps live in AsyncLocalStorage when Node provides it.
interface Store {
  route?: string
  steps?: AiCallSample['steps']
}
interface Als {
  run<R>(store: Store, fn: () => R): R
  getStore(): Store | undefined
}
let als: Als | undefined
let shared: Recorder | undefined

function recorder(options: WatchOptions): Recorder {
  if (Object.keys(options).length) return new Recorder(options)
  shared ??= new Recorder({})
  return shared
}

/**
 * Wraps an Anthropic, OpenAI or Google GenAI client. Same client, now measured:
 * `const client = watchAI(new Anthropic())`. Prompts are not stored unless `logPrompts`.
 */
export function watchAI<T>(client: T, options: WatchOptions = {}): T {
  if (typeof client !== 'object' || client === null) return client
  return proxy(client, '', recorder(options)) as T
}

/** Times a tool or retrieval step inside an agent; steps attach to the next recorded AI call on the same route. */
watchAI.step = async function step<R>(
  kind: 'tool' | 'rag',
  name: string,
  fn: () => Promise<R> | R,
): Promise<R> {
  const started = now()
  try {
    return await fn()
  } finally {
    const store = als?.getStore()
    if (store) (store.steps ??= []).push({ kind, name, ms: Math.round(now() - started) })
  }
}

/** Runs `fn` with a route label attached to every AI call inside it (Node only). */
export async function withRoute<R>(route: string, fn: () => Promise<R> | R): Promise<R> {
  if (!als) {
    try {
      const { AsyncLocalStorage } = await import('node:async_hooks')
      als = new AsyncLocalStorage()
    } catch {
      return fn()
    }
  }
  return als.run({ route, steps: [] }, fn)
}

/** Vercel AI SDK and other function-style APIs: `const { generateText } = wrapAI({ generateText, streamText })`. */
export function wrapAI<T extends Record<string, unknown>>(fns: T, options: WatchOptions = {}): T {
  const rec = recorder(options)
  const out: Record<string, unknown> = {}
  for (const [name, fn] of Object.entries(fns))
    out[name] =
      typeof fn === 'function'
        ? wrapCall(fn as (...a: unknown[]) => unknown, name, 'vercel-ai', rec, undefined)
        : fn
  return out as T
}

/** Measures plain `fetch` calls to known AI hosts; others pass through untouched. */
export function watchFetch(
  fetchImpl: typeof fetch = fetch,
  options: WatchOptions = {},
): typeof fetch {
  const rec = recorder(options)
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const provider = providerForUrl(url)
    if (!provider) return fetchImpl(input, init)
    const started = now()
    const sample = baseSample(provider, 'fetch', rec, started)
    sample.model = modelFromBody(init?.body) ?? 'unknown'
    try {
      const response = await fetchImpl(input, init)
      sample.firstTokenMs = Math.round(now() - started)
      if (!response.ok) sample.error = String(response.status)
      if (!response.body) {
        finish(sample, started, rec)
        return response
      }
      const [forUser, forUs] = response.body.tee()
      void readUsage(forUs, sample, started, rec)
      return new Response(forUser, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    } catch (error) {
      sample.error = errorInfo(error)
      rec.noteError('fetch', started)
      finish(sample, started, rec)
      throw error
    }
  }
}

function proxy(target: object, path: string, rec: Recorder): object {
  return new Proxy(target, {
    get(obj, prop) {
      const value: unknown = Reflect.get(obj, prop, obj)
      if (typeof prop !== 'string') return value
      const here = path ? `${path}.${prop}` : prop
      if (typeof value === 'function') {
        const tail = here.split('.').slice(-3).join('.')
        const key = [...WATCHED].find((w) => tail.endsWith(w))
        return key
          ? wrapCall(value as (...a: unknown[]) => unknown, key, providerForPath(key), rec, obj)
          : (value as (...a: unknown[]) => unknown).bind(obj)
      }
      if (typeof value === 'object' && value !== null && !prop.startsWith('_'))
        return proxy(value, here, rec)
      return value
    },
  })
}

function wrapCall(
  fn: (...a: unknown[]) => unknown,
  path: string,
  provider: string,
  rec: Recorder,
  self: object | undefined,
): (...a: unknown[]) => unknown {
  return function measured(this: unknown, ...args: unknown[]): unknown {
    const started = now()
    const sample = baseSample(provider, path, rec, started)
    const params = args[0] as Record<string, unknown> | undefined
    sample.model = modelOf(params, 'unknown')
    if (rec.options.logPrompts) sample.prompt = safeJson(params)
    let result: unknown
    try {
      result = fn.apply(self ?? this, args)
    } catch (error) {
      fail(sample, started, rec, path, error)
      throw error
    }
    // shortcut: an SDK APIPromise becomes a plain Promise here (`.withResponse()` is lost); wrap it with Proxy if someone needs it.
    if (isThenable(result))
      return result.then(
        (value) => settle(value, sample, started, rec),
        (error: unknown) => {
          fail(sample, started, rec, path, error)
          throw error
        },
      )
    return settle(result, sample, started, rec)
  }
}

function settle(value: unknown, sample: Sample, started: number, rec: Recorder): unknown {
  if (typeof value === 'object' && value !== null && Symbol.asyncIterator in value)
    return streamProxy(value, sample, started, rec)
  const usage = usageOf(value)
  if (usage)
    Object.assign(sample, {
      inputTokens: usage.input,
      outputTokens: usage.output,
      cachedTokens: usage.cached,
    })
  sample.model = modelOf(value, sample.model)
  if (rec.options.logPrompts) sample.answer = safeJson(value)
  const lateUsage = (value as { usage?: unknown } | null)?.usage
  if (isThenable(lateUsage)) {
    // Vercel streamText: usage resolves when the stream ends.
    void lateUsage.then(
      (u) => {
        const late = usageOf({ usage: u })
        if (late)
          Object.assign(sample, {
            inputTokens: late.input,
            outputTokens: late.output,
            cachedTokens: late.cached,
          })
        finish(sample, started, rec)
      },
      () => finish(sample, started, rec),
    )
    return value
  }
  sample.firstTokenMs = Math.round(now() - started)
  finish(sample, started, rec)
  return value
}

/** Keeps the original stream object (its methods, `finalMessage()`, etc.) and only observes iteration. */
function streamProxy(stream: object, sample: Sample, started: number, rec: Recorder): object {
  return new Proxy(stream, {
    get(obj, prop) {
      if (prop !== Symbol.asyncIterator) {
        const v: unknown = Reflect.get(obj, prop, obj)
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(obj) : v
      }
      return () =>
        observe((obj as AsyncIterable<unknown>)[Symbol.asyncIterator](), sample, started, rec)
    },
  })
}

async function* observe(
  iterator: AsyncIterator<unknown>,
  sample: Sample,
  started: number,
  rec: Recorder,
): AsyncGenerator {
  let last = started
  let answer = ''
  try {
    for (;;) {
      const next = await iterator.next()
      if (next.done) break
      const t = now()
      if (!sample.firstTokenMs) sample.firstTokenMs = Math.round(t - started)
      else if (t - last > STALL_MS) sample.stalls++
      last = t
      const usage = usageOf(next.value)
      if (usage)
        Object.assign(sample, {
          inputTokens: usage.input || sample.inputTokens,
          outputTokens: usage.output || sample.outputTokens,
          cachedTokens: usage.cached || sample.cachedTokens,
        })
      sample.model = modelOf(next.value, sample.model)
      if (rec.options.logPrompts) answer += textOf(next.value)
      yield next.value
    }
    if (rec.options.logPrompts) sample.answer = answer
    finish(sample, started, rec)
  } catch (error) {
    fail(sample, started, rec, sample.path ?? '', error)
    throw error
  }
}

async function readUsage(
  body: ReadableStream<Uint8Array>,
  sample: Sample,
  started: number,
  rec: Recorder,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let last = started
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const t = now()
      if (t - last > STALL_MS) sample.stalls++
      last = t
      if (text.length < 200_000) text += decoder.decode(value, { stream: true })
    }
  } catch {
    sample.error ??= 'stream-error'
  }
  for (const line of text.split('\n')) {
    const json = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
    if (!json.startsWith('{')) continue
    try {
      const usage = usageOf(JSON.parse(json))
      if (usage?.input || usage?.output)
        Object.assign(sample, {
          inputTokens: usage.input,
          outputTokens: usage.output,
          cachedTokens: usage.cached,
        })
    } catch {
      // Not JSON: a text chunk.
    }
  }
  finish(sample, started, rec)
}

function baseSample(provider: string, path: string, rec: Recorder, started: number): Sample {
  const store = als?.getStore()
  return {
    at: new Date().toISOString(),
    route: rec.options.route ?? store?.route,
    model: 'unknown',
    provider,
    firstTokenMs: 0,
    totalMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    costUsd: 0,
    retries: rec.retriesFor(path, started),
    stalls: 0,
    path,
    steps: store?.steps?.length ? store.steps.splice(0) : undefined,
  }
}

function finish(sample: Sample, started: number, rec: Recorder): void {
  sample.totalMs = Math.round(now() - started)
  if (!sample.firstTokenMs) sample.firstTokenMs = sample.totalMs
  rec.record(sample)
}

function fail(sample: Sample, started: number, rec: Recorder, path: string, error: unknown): void {
  sample.error = errorInfo(error)
  rec.noteError(path, started)
  finish(sample, started, rec)
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function modelFromBody(body: RequestInit['body']): string | undefined {
  if (typeof body !== 'string') return undefined
  const match = /"model"\s*:\s*"([^"]+)"/.exec(body)
  return match?.[1]
}

function textOf(chunk: unknown): string {
  const c = chunk as {
    delta?: { text?: string }
    choices?: { delta?: { content?: string } }[]
  } | null
  return c?.delta?.text ?? c?.choices?.[0]?.delta?.content ?? ''
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 20_000)
  } catch {
    return ''
  }
}
