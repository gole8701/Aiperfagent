/*
 * Real-user snippet. Rules: no cookies, no credentials, no query strings, no
 * personal data; every hook is wrapped so a failure here never reaches the
 * host page; batches go out with sendBeacon; nothing is retried more than once
 * a minute when the collector is down. Size budget: 8 KB minified.
 */
export interface AgentOptions {
  endpoint?: string
  /** 0–1 share of sessions that report; default 1. */
  sample?: number
  /** Route label; defaults to location.pathname. */
  route?: string
  flushMs?: number
}

export type AgentEvent = Record<string, unknown> & { t: string; at: number; route: string }

const AI_HOSTS = ['api.anthropic.com', 'api.openai.com', 'generativelanguage.googleapis.com', 'openai.azure.com', 'api.groq.com', 'openrouter.ai', 'api.mistral.ai', 'api.deepseek.com', ':11434']
const DEFAULT_ENDPOINT = 'http://127.0.0.1:4545/agent/collect'

export function start(options: AgentOptions = {}): void {
  const w = window as Window & { __perfagent?: boolean; __perfagentOriginalFetch?: typeof fetch }
  if (w.__perfagent || Math.random() >= (options.sample ?? 1)) return
  w.__perfagent = true
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const route = (): string => options.route ?? location.pathname
  const queue: AgentEvent[] = []
  let pausedUntil = 0
  const now = (): number => Math.round(performance.now())
  const clean = (url: string): string => url.split('#')[0]?.split('?')[0] ?? ''
  const guard = (fn: () => void): void => {
    try {
      fn()
    } catch {
      /* never into the page */
    }
  }
  const push = (t: string, data: Record<string, unknown>): void => {
    queue.push({ t, at: Date.now(), route: route(), ...data })
    if (queue.length > 500) queue.splice(0, queue.length - 500)
  }
  const selector = (el: unknown): string | undefined => {
    const e = el as Element | null
    if (!e?.tagName) return undefined
    return e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/)[0]}` : '')
  }

  const flush = (): void => {
    if (!queue.length || Date.now() < pausedUntil) return
    const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory
    if (mem) push('mem', { mb: Math.round(mem.usedJSHeapSize / 1048576) })
    const body = JSON.stringify(queue.splice(0))
    let sent = false
    try {
      sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
    } catch {
      /* fall back */
    }
    if (!sent) {
      const f = w.__perfagentOriginalFetch ?? fetch
      f(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' }, credentials: 'omit', mode: 'cors' }).then((r) => { if (!r.ok) pausedUntil = Date.now() + 60000 }, () => { pausedUntil = Date.now() + 60000 })
    }
  }
  setInterval(flush, options.flushMs ?? 5000)
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  addEventListener('pagehide', flush)

  // Web Vitals, own implementation with attribution.
  const observe = (type: string, cb: (entries: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}): void => guard(() => {
    new PerformanceObserver((list) => guard(() => cb(list.getEntries()))).observe({ type, buffered: true, ...extra })
  })
  let cls = 0
  observe('largest-contentful-paint', (es) => { const e = es[es.length - 1] as (PerformanceEntry & { element?: Element }) | undefined; if (e) push('vital', { name: 'lcp', value: Math.round(e.startTime), target: selector(e.element) }) })
  observe('layout-shift', (es) => { for (const e of es as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] })[]) if (!e.hadRecentInput) { cls += e.value; push('vital', { name: 'cls', value: Math.round(cls * 1000) / 1000, target: selector(e.sources?.[0]?.node) }) } })
  observe('paint', (es) => { for (const e of es) if (e.name === 'first-contentful-paint') push('vital', { name: 'fcp', value: Math.round(e.startTime) }) })
  observe('navigation', (es) => { const e = es[0] as PerformanceNavigationTiming | undefined; if (e) push('vital', { name: 'ttfb', value: Math.round(e.responseStart) }) })
  let inp = 0
  observe('event', (es) => { for (const e of es as (PerformanceEntry & { interactionId?: number; target?: Element })[]) if (e.interactionId && e.duration > inp) { inp = e.duration; push('vital', { name: 'inp', value: Math.round(inp), target: selector(e.target), type: e.name }) } }, { durationThreshold: 40 })
  observe('longtask', (es) => { for (const e of es) push('task', { ms: Math.round(e.duration) }) })

  // fetch, with AI calls measured to the first streamed chunk.
  guard(() => {
    const original = w.fetch.bind(w)
    w.__perfagentOriginalFetch = original
    w.fetch = (input, init) => {
      const url = clean(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      const started = now()
      const ai = AI_HOSTS.some((h) => url.includes(h))
      return original(input, init).then((res) => {
        guard(() => {
          const size = Number(res.headers.get('content-length') ?? 0)
          if (!ai || !res.body) {
            push(ai ? 'ai' : 'req', { url, method: (init?.method ?? 'GET').toUpperCase(), status: res.status, ms: now() - started, size })
            return
          }
          const [a, b] = res.body.tee()
          const reader = b.getReader()
          let first = 0
          let text = ''
          const read = (): void => { reader.read().then(({ done, value }) => { if (done) { push('ai', { url, status: res.status, firstTokenMs: first, ms: now() - started, ...tokens(text), model: model(init?.body) }); return } if (!first) first = now() - started; if (text.length < 100000) text += new TextDecoder().decode(value); read() }, () => undefined) }
          read()
          Object.defineProperty(res, 'body', { value: a })
        })
        return res
      }, (err: unknown) => { push(ai ? 'ai' : 'req', { url, status: 0, ms: now() - started, error: 'network' }); throw err })
    }
  })

  // XMLHttpRequest
  guard(() => {
    const proto = XMLHttpRequest.prototype
    // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the XHR as `this` below
    const open = proto.open
    proto.open = function (this: XMLHttpRequest & { __pa?: [string, string, number] }, method: string, url: string | URL) {
      this.__pa = [method.toUpperCase(), clean(String(url)), 0]
      this.addEventListener('loadstart', () => { if (this.__pa) this.__pa[2] = now() })
      this.addEventListener('loadend', () => guard(() => { const p = this.__pa; if (p) push('req', { url: p[1], method: p[0], status: this.status, ms: now() - p[2], size: Number(this.getResponseHeader('content-length') ?? 0) }) }))
      // eslint-disable-next-line prefer-rest-params
      return open.apply(this, arguments as unknown as Parameters<typeof open>)
    } as typeof proto.open
  })

  // WebSocket: open latency, traffic, reconnects per URL.
  guard(() => {
    const Native = globalThis.WebSocket
    const seen: Record<string, number> = {}
    const Wrapped = function (url: string | URL, protocols?: string | string[]) {
      const ws = protocols === undefined ? new Native(url) : new Native(url, protocols)
      const u = clean(String(url))
      const started = now()
      seen[u] = (seen[u] ?? 0) + 1
      let inN = 0, inB = 0, outN = 0, outB = 0
      const report = (kind: string, extra: Record<string, unknown> = {}): void => push('ws', { url: u, kind, in: inN, inBytes: inB, out: outN, outBytes: outB, reconnects: (seen[u] ?? 1) - 1, ...extra })
      ws.addEventListener('open', () => report('open', { ms: now() - started }))
      ws.addEventListener('message', (e: MessageEvent) => { inN++; inB += size(e.data) })
      ws.addEventListener('close', (e: CloseEvent) => report('close', { code: e.code }))
      ws.addEventListener('error', () => report('error'))
      const send = ws.send.bind(ws)
      ws.send = (data: Parameters<WebSocket['send']>[0]) => { outN++; outB += size(data); send(data) }
      return ws
    } as unknown as typeof WebSocket
    Wrapped.prototype = Native.prototype
    Object.assign(Wrapped, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 })
    globalThis.WebSocket = Wrapped
  })

  // Errors: message and the top stack frame only.
  addEventListener('error', (e) => guard(() => push('err', { message: e.message.slice(0, 200), frame: frame(e.error) })))
  addEventListener('unhandledrejection', (e) => guard(() => push('err', { message: String((e.reason as { message?: string } | undefined)?.message ?? e.reason).slice(0, 200), frame: frame(e.reason) })))

  // Soft navigations
  guard(() => {
    const ps = history.pushState.bind(history)
    history.pushState = (...args) => { ps(...args); guard(() => push('nav', { to: clean(location.pathname) })) }
  })
}

function size(data: unknown): number {
  if (typeof data === 'string') return data.length
  const d = data as { byteLength?: number; size?: number } | null
  return d?.byteLength ?? d?.size ?? 0
}

function frame(error: unknown): string | undefined {
  const stack = (error as { stack?: string } | undefined)?.stack
  const line = stack?.split('\n').find((l) => /\s+at\s|@/.test(l))
  return line?.trim().split('?')[0]?.slice(0, 200)
}

function model(body: unknown): string | undefined {
  return typeof body === 'string' ? /"model"\s*:\s*"([^"]+)"/.exec(body)?.[1] : undefined
}

function tokens(text: string): { inputTokens?: number; outputTokens?: number } {
  const i = /"(?:input_tokens|prompt_tokens|promptTokenCount)"\s*:\s*(\d+)/.exec(text)
  const o = /"(?:output_tokens|completion_tokens|candidatesTokenCount)"\s*:\s*(\d+)/.exec(text)
  return { inputTokens: i ? Number(i[1]) : undefined, outputTokens: o ? Number(o[1]) : undefined }
}
