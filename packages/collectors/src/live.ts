import type { LiveStats } from '@perfagent/core'
import type { Browser, BrowserContext, CDPSession } from 'playwright-core'

/**
 * Live mode B: opens the site in a browser we control and streams what the
 * Chrome DevTools Protocol sees every second: requests, latency, WebSocket
 * frames, reconnects and memory. Peaks are flagged against a threshold.
 */
export interface LiveTick {
  at: string
  requestsPerSec: number
  p95LatencyMs: number
  wsMessagesPerSec: number
  wsBytesPerSec: number
  wsReconnects: number
  wsRttMs: number
  memoryMb: number
  slowest: { url: string; ms: number }[]
  peak?: { metric: string; value: number }
}

export interface LiveSession {
  stop: () => Promise<LiveStats>
}

export async function startLiveSession(browser: Browser, url: string, options: { intervalMs?: number; peakThresholdP95Ms?: number; windowSeconds?: number; onTick: (tick: LiveTick) => void }): Promise<LiveSession> {
  const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const cdp: CDPSession = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Performance.enable')

  const window: LiveTick[] = []
  const windowSeconds = options.windowSeconds ?? 60
  const threshold = options.peakThresholdP95Ms ?? 1500
  const reconnects: { at: string; reason: string }[] = []
  const bucket = { requests: 0, latencies: [] as number[], wsMessages: 0, wsBytes: 0, rtts: [] as number[], slowest: [] as { url: string; ms: number }[] }
  const pending = new Map<string, { url: string; start: number }>()
  const wsSent = new Map<string, number>()

  cdp.on('Network.requestWillBeSent', (e) => { pending.set(e.requestId, { url: e.request.url, start: e.timestamp * 1000 }); bucket.requests++ })
  cdp.on('Network.loadingFinished', (e) => {
    const p = pending.get(e.requestId)
    if (!p) return
    const ms = e.timestamp * 1000 - p.start
    bucket.latencies.push(ms)
    bucket.slowest.push({ url: p.url, ms })
    pending.delete(e.requestId)
  })
  cdp.on('Network.webSocketCreated', (e) => { if (reconnects.length || window.length) reconnects.push({ at: new Date().toISOString(), reason: `new connection to ${new URL(e.url).host}` }) })
  cdp.on('Network.webSocketClosed', () => { reconnects.push({ at: new Date().toISOString(), reason: 'connection closed' }) })
  cdp.on('Network.webSocketFrameSent', (e) => { bucket.wsMessages++; bucket.wsBytes += e.response.payloadData.length; wsSent.set(e.requestId, e.timestamp * 1000) })
  cdp.on('Network.webSocketFrameReceived', (e) => {
    bucket.wsMessages++
    bucket.wsBytes += e.response.payloadData.length
    const sent = wsSent.get(e.requestId)
    if (sent) { bucket.rtts.push(e.timestamp * 1000 - sent); wsSent.delete(e.requestId) }
  })

  await page.goto(url, { waitUntil: 'load', timeout: 45_000 }).catch(() => undefined)

  const interval = options.intervalMs ?? 1000
  const timer = setInterval(() => {
    void (async () => {
      const { metrics } = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] as { name: string; value: number }[] }))
      const heap = (metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1_048_576
      const seconds = interval / 1000
      const sorted = [...bucket.latencies].sort((a, b) => a - b)
      const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0
      const tick: LiveTick = {
        at: new Date().toISOString(),
        requestsPerSec: bucket.requests / seconds,
        p95LatencyMs: Math.round(p95),
        wsMessagesPerSec: bucket.wsMessages / seconds,
        wsBytesPerSec: bucket.wsBytes / seconds,
        wsReconnects: reconnects.length,
        wsRttMs: Math.round(bucket.rtts.reduce((a, b) => a + b, 0) / Math.max(1, bucket.rtts.length)),
        memoryMb: Math.round(heap),
        slowest: bucket.slowest.sort((a, b) => b.ms - a.ms).slice(0, 5),
      }
      if (p95 > threshold) tick.peak = { metric: 'p95LatencyMs', value: Math.round(p95) }
      else if (bucket.requests / seconds > 50) tick.peak = { metric: 'requestsPerSec', value: bucket.requests / seconds }
      window.push(tick)
      while (window.length > windowSeconds) window.shift()
      bucket.requests = 0; bucket.latencies = []; bucket.wsMessages = 0; bucket.wsBytes = 0; bucket.rtts = []; bucket.slowest = []
      options.onTick(tick)
    })()
  }, interval)

  return {
    stop: async () => {
      clearInterval(timer)
      await context.close().catch(() => undefined)
      return {
        windowSeconds,
        requestsPerSec: window.map((t) => t.requestsPerSec),
        p95LatencyMs: window.map((t) => t.p95LatencyMs),
        websocket: { messagesPerSec: window.map((t) => t.wsMessagesPerSec), bytesPerSec: window.map((t) => t.wsBytesPerSec), reconnects, rttMs: window.map((t) => t.wsRttMs) },
        peaks: window.filter((t) => t.peak).map((t) => ({ at: t.at, metric: t.peak?.metric ?? '', value: t.peak?.value ?? 0 })),
        clusters: clusterSlow(window),
        memoryMb: window.map((t) => t.memoryMb),
      }
    },
  }
}

/** "80% of slow seconds = WebSocket reconnect storm" style grouping, from what a single browser can see. */
function clusterSlow(window: LiveTick[]): LiveStats['clusters'] {
  const slow = window.filter((t) => t.peak)
  if (slow.length === 0) return []
  const withReconnect = slow.filter((t, i) => i > 0 && t.wsReconnects > (slow[i - 1]?.wsReconnects ?? 0)).length
  const clusters: NonNullable<LiveStats['clusters']> = []
  if (withReconnect) clusters.push({ label: 'WebSocket reconnect storm', share: withReconnect / slow.length, reason: 'latency peaks coincide with reconnects' })
  const api = slow.filter((t) => t.slowest.some((s) => /\/api\//.test(s.url))).length
  if (api) clusters.push({ label: 'Slow API responses', share: api / slow.length, reason: 'slowest requests are API calls' })
  return clusters
}
