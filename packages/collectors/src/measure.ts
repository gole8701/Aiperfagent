import {
  computeScore,
  median,
  metricValue,
  type FilmstripFrame,
  type LayoutShift,
  type LongTask,
  type MetricId,
  type MetricValue,
  type PageResult,
  type RequestInfo,
  type TimelinePhase,
} from '@perfagent/core'
import { redactUrl } from '@perfagent/security'
import type { Browser, CDPSession, Page } from 'playwright-core'

import { INJECTED_SCRIPT, type InjectedState } from './inject.js'
import { PROFILES, type DeviceProfile } from './profiles.js'
import { collectReadiness } from './readiness.js'
import { SourceMapper } from './sourcemap.js'

export interface MeasureOptions {
  url: string
  route?: string
  device?: 'mobile' | 'desktop'
  runs?: number
  /** Capture a filmstrip through the CDP screencast (Chromium only). */
  filmstrip?: boolean
  /** Record JS/CSS coverage (Chromium only, slower). */
  coverage?: boolean
  /** Run the agent-readiness checks on the first run. */
  readiness?: boolean
  /** Relative project file paths; lets long tasks map back to source file:line. */
  projectFiles?: Set<string>
  timeoutMs?: number
  onProgress?: (run: number, total: number) => void
}

interface SingleRun {
  metrics: Partial<Record<MetricId, number>>
  requests: RequestInfo[]
  longTasks: LongTask[]
  layoutShifts: LayoutShift[]
  filmstrip: FilmstripFrame[]
  lcpElement?: string
  features: Record<string, boolean | number | string>
  coverage?: PageResult['coverage']
  phases: TimelinePhase[]
}

const MEDIAN_METRICS: MetricId[] = [
  'lcp',
  'inp',
  'cls',
  'ttfb',
  'fcp',
  'tbt',
  'si',
  'jsKb',
  'requests',
  'transferKb',
  'memoryMb',
  'wsReconnects',
  'wsMessagesPerSec',
]

/** Measures one page N times and reports the median of each metric. */
export async function measurePage(browser: Browser, options: MeasureOptions): Promise<PageResult> {
  const runs = options.runs ?? 3
  const profile = PROFILES[options.device ?? 'mobile']
  const results: SingleRun[] = []
  for (let i = 0; i < runs; i++) {
    options.onProgress?.(i + 1, runs)
    results.push(await measureOnce(browser, options, profile, i === 0))
  }
  const metrics: MetricValue[] = []
  for (const id of MEDIAN_METRICS) {
    const samples = results.map((r) => r.metrics[id]).filter((v): v is number => v !== undefined)
    if (samples.length === 0) continue
    metrics.push({
      id,
      value: round(median(samples), id),
      unit: unitOf(id),
      samples: samples.map((s) => round(s, id)),
    })
  }
  const first = results[0]
  const readiness = first?.features.agentReadiness
  if (typeof readiness === 'number')
    metrics.push({ id: 'agentReadiness', value: readiness, unit: 'score' })
  metrics.push({ id: 'score', value: computeScore(metrics), unit: 'score' })
  // The run closest to the median LCP represents the page (requests, filmstrip, etc).
  const representative = results.reduce(
    (best, r) =>
      Math.abs((r.metrics.lcp ?? 0) - (metricValue(metrics, 'lcp') ?? 0)) <
      Math.abs((best.metrics.lcp ?? 0) - (metricValue(metrics, 'lcp') ?? 0))
        ? r
        : best,
    first ?? emptyRun(),
  )
  return {
    url: options.url,
    route: options.route ?? routeOf(options.url),
    device: profile.name,
    runs,
    metrics,
    phases: representative.phases,
    requests: representative.requests,
    longTasks: representative.longTasks,
    layoutShifts: representative.layoutShifts,
    filmstrip: representative.filmstrip,
    lcpElement: representative.lcpElement,
    features: first?.features,
    coverage: first?.coverage,
  }
}

async function measureOnce(
  browser: Browser,
  options: MeasureOptions,
  profile: DeviceProfile,
  firstRun: boolean,
): Promise<SingleRun> {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
    userAgent: profile.userAgent,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  const isChromium = browser.browserType().name() === 'chromium'
  const cdp = isChromium ? await context.newCDPSession(page) : undefined
  const requests = new Map<string, RequestInfo & { requestId?: string }>()
  const frames: FilmstripFrame[] = []
  const wsStats = { reconnects: 0, messages: 0, bytes: 0 }
  const origin = new URL(options.url).hostname
  const navigationStart = { at: 0 }

  await page.addInitScript(INJECTED_SCRIPT)
  if (cdp) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.network.latencyMs,
      downloadThroughput: (profile.network.downloadKbps * 1024) / 8,
      uploadThroughput: (profile.network.uploadKbps * 1024) / 8,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle })
    await cdp.send('Performance.enable')
    wireNetwork(cdp, requests, origin, navigationStart)
    if (options.filmstrip !== false) await startScreencast(cdp, frames, navigationStart)
    if (options.coverage && firstRun) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false })
      await page.coverage.startCSSCoverage({ resetOnNavigation: false })
    }
  }
  page.on('websocket', (ws) => {
    wsStats.reconnects++
    ws.on('framereceived', (f) => {
      wsStats.messages++
      wsStats.bytes += f.payload.length
    })
    ws.on('framesent', (f) => {
      wsStats.messages++
      wsStats.bytes += f.payload.length
    })
  })

  const timeout = options.timeoutMs ?? 45_000
  navigationStart.at = Date.now()
  await page.goto(options.url, { waitUntil: 'load', timeout }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)
  await page.waitForTimeout(500)
  await interact(page)
  await page.waitForTimeout(800)

  const state = await page
    .evaluate(() => (window as unknown as { __perfagent: InjectedState }).__perfagent)
    .catch(() => undefined)
  const mapper = options.projectFiles
    ? new SourceMapper({
        projectFiles: options.projectFiles,
        fetch: (u) =>
          page.request.get(u, { timeout: 5000 }).then((r) => (r.ok() ? r.text() : undefined)),
      })
    : undefined
  const timing = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : 0,
        responseEnd: nav?.responseEnd ?? 0,
        domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
        load: nav?.loadEventEnd ?? 0,
        heap: mem ? mem.usedJSHeapSize / 1_048_576 : 0,
      }
    })
    .catch(() => ({ ttfb: 0, responseEnd: 0, domContentLoaded: 0, load: 0, heap: 0 }))
  const scriptMs = cdp ? await scriptDuration(cdp) : 0

  let coverage: PageResult['coverage']
  if (cdp && options.coverage && firstRun) {
    const [js, css] = await Promise.all([
      page.coverage.stopJSCoverage(),
      page.coverage.stopCSSCoverage(),
    ])
    const fromCss = css.map((entry) => ({
      url: entry.url,
      total: entry.text?.length ?? 0,
      used: entry.ranges.reduce((sum, r) => sum + (r.end - r.start), 0),
    }))
    const fromJs = js.map((entry) => ({
      url: entry.url,
      total: entry.source?.length ?? 0,
      used: entry.functions
        .flatMap((f) => f.ranges)
        .filter((r) => r.count > 0)
        .reduce((sum, r) => sum + (r.endOffset - r.startOffset), 0),
    }))
    coverage = [...fromCss, ...fromJs]
      .filter((c) => c.total > 0)
      .map((c) => ({
        url: redactUrl(c.url),
        totalBytes: c.total,
        unusedBytes: Math.max(0, c.total - Math.min(c.total, c.used)),
      }))
  }
  if (cdp && options.filmstrip !== false)
    await cdp.send('Page.stopScreencast').catch(() => undefined)

  const features: Record<string, boolean | number | string> = {
    ...(state?.features ?? {}),
    softNavigations: state?.softNav ?? 0,
  }
  if (firstRun && options.readiness !== false)
    Object.assign(features, await collectReadiness(page, options.url))
  // Source maps are fetched through the page's own session, so this runs before the context closes.
  const longTasks: LongTask[] = (state?.longTasks ?? []).map((t) => ({
    startMs: t.startMs,
    durationMs: t.durationMs,
    script: t.script,
  }))
  for (const f of state?.loaf ?? [])
    if (f.script)
      longTasks.push({
        startMs: f.startMs,
        durationMs: f.durationMs,
        script: `${f.script}${f.fn ? ` ${f.fn}()` : ''}`,
        location: await mapScript(mapper, f.script, f.line),
      })
  await context.close()

  const requestList = [...requests.values()].map(({ requestId: _id, ...r }) => r)
  const fcp = state?.fcp ?? 0
  const tbt = (state?.longTasks ?? [])
    .filter((t) => t.startMs >= fcp)
    .reduce((sum, t) => sum + Math.max(0, t.durationMs - 50), 0)
  const inp = worstInteraction(state?.interactions ?? [])
  const jsBytes = requestList
    .filter((r) => r.type === 'script')
    .reduce((s, r) => s + r.transferBytes, 0)
  const transfer = requestList.reduce((s, r) => s + r.transferBytes, 0)
  const lcp = state?.lcp ?? 0
  const server = Math.round(timing.ttfb)
  const download = Math.max(0, Math.round(timing.responseEnd - timing.ttfb))
  const script = Math.round(scriptMs)
  const render = Math.max(0, Math.round(lcp - server - download - script))

  return {
    metrics: {
      lcp,
      fcp,
      cls: state?.cls ?? 0,
      ttfb: timing.ttfb,
      tbt,
      inp,
      si: speedIndex(frames, lcp),
      jsKb: jsBytes / 1024,
      requests: requestList.length,
      transferKb: transfer / 1024,
      memoryMb: timing.heap,
      wsReconnects: Math.max(0, wsStats.reconnects - 1),
      wsMessagesPerSec: wsStats.messages / Math.max(1, (Date.now() - navigationStart.at) / 1000),
    },
    requests: requestList,
    longTasks,
    layoutShifts: (state?.shifts ?? []).map((s) => ({
      value: s.value,
      timeMs: s.timeMs,
      element: s.element,
    })),
    filmstrip: frames.slice(0, 12),
    lcpElement: state?.lcpElement === '' ? undefined : state?.lcpElement,
    features,
    coverage,
    phases: [
      { phase: 'server', ms: server },
      { phase: 'download', ms: download },
      { phase: 'script', ms: script },
      { phase: 'render', ms: render },
    ],
  }
}

function wireNetwork(
  cdp: CDPSession,
  requests: Map<string, RequestInfo & { requestId?: string }>,
  origin: string,
  start: { at: number },
): void {
  const starts = new Map<string, number>()
  cdp.on('Network.requestWillBeSent', (e) => {
    starts.set(e.requestId, e.timestamp * 1000)
    const url = redactUrl(e.request.url)
    requests.set(e.requestId, {
      url,
      type: typeOf(e.type, url),
      transferBytes: 0,
      startMs: 0,
      durationMs: 0,
      status: 0,
      thirdParty: !sameSite(url, origin),
      cached: false,
      initiator: e.initiator.url ? redactUrl(e.initiator.url) : e.initiator.type,
    })
  })
  cdp.on('Network.responseReceived', (e) => {
    const r = requests.get(e.requestId)
    if (!r) return
    r.status = e.response.status
    r.cached =
      Boolean(e.response.fromDiskCache) ||
      Boolean(e.response.fromServiceWorker) ||
      Boolean(e.response.fromPrefetchCache)
    r.protocol =
      e.response.headers['content-encoding'] ??
      e.response.headers['Content-Encoding'] ??
      e.response.protocol ??
      ''
    const t = e.response.timing
    if (t)
      r.startMs = Math.max(
        0,
        Math.round(
          t.requestTime * 1000 -
            (starts.get(e.requestId) ?? 0) +
            (t.requestTime * 1000 - (start.at - performanceOrigin())),
        ),
      )
  })
  cdp.on('Network.loadingFinished', (e) => {
    const r = requests.get(e.requestId)
    if (!r) return
    r.transferBytes = e.encodedDataLength
    r.durationMs = Math.max(
      0,
      Math.round(e.timestamp * 1000 - (starts.get(e.requestId) ?? e.timestamp * 1000)),
    )
    r.startMs = Math.max(0, Math.round((starts.get(e.requestId) ?? 0) - (firstStart(starts) ?? 0)))
    r.blocking = r.type === 'script' && /^(script)$/.test(r.type) && r.startMs < 1500 && !r.cached
  })
  cdp.on('Network.webSocketCreated', (e) => {
    requests.set(e.requestId, {
      url: redactUrl(e.url),
      type: 'websocket',
      transferBytes: 0,
      startMs: Math.max(0, Date.now() - start.at),
      durationMs: 0,
      status: 101,
      thirdParty: !sameSite(e.url, origin),
      cached: false,
    })
  })
  cdp.on('Network.webSocketFrameReceived', (e) => {
    const r = requests.get(e.requestId)
    if (r) r.transferBytes += e.response.payloadData.length
  })
}

async function mapScript(
  mapper: SourceMapper | undefined,
  url: string,
  charOffset: number | undefined,
): Promise<LongTask['location']> {
  if (!mapper || !/^https?:/.test(url)) return undefined
  return mapper.toSource(
    charOffset === undefined ? { url, line: 1, column: 1 } : { url, charOffset },
  )
}

function performanceOrigin(): number {
  return 0
}
function firstStart(starts: Map<string, number>): number | undefined {
  let min: number | undefined
  for (const v of starts.values()) if (min === undefined || v < min) min = v
  return min
}

async function startScreencast(
  cdp: CDPSession,
  frames: FilmstripFrame[],
  start: { at: number },
): Promise<void> {
  cdp.on('Page.screencastFrame', (e) => {
    const at = Math.max(
      0,
      Math.round(
        e.metadata.timestamp ? e.metadata.timestamp * 1000 - start.at : Date.now() - start.at,
      ),
    )
    const last = frames[frames.length - 1]
    if (!last || at - last.timeMs >= 250)
      frames.push({ timeMs: at, image: `data:image/jpeg;base64,${e.data}` })
    cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => undefined)
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 35,
    maxWidth: 240,
    maxHeight: 480,
    everyNthFrame: 2,
  })
}

async function scriptDuration(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp
    .send('Performance.getMetrics')
    .catch(() => ({ metrics: [] as { name: string; value: number }[] }))
  return (metrics.find((m) => m.name === 'ScriptDuration')?.value ?? 0) * 1000
}

/** Scripted interactions so INP has something to measure: first button, first text input. */
async function interact(page: Page): Promise<void> {
  const input = page.locator('input[type="text"], input:not([type]), textarea').first()
  if (await input.count().catch(() => 0))
    await input.pressSequentially('perf', { delay: 40 }).catch(() => undefined)
  const button = page.locator('button:visible').first()
  if (await button.count().catch(() => 0))
    await button.click({ timeout: 2000, trial: false }).catch(() => undefined)
}

/** Undefined when no event timing entry was seen: INP was not measured, which is not the same as 0 ms. */
export function worstInteraction(list: { durationMs: number }[]): number | undefined {
  const sorted = [...list].sort((a, b) => b.durationMs - a.durationMs)
  // INP ignores the single worst interaction once there are many; with few, it's the max.
  return sorted[Math.min(sorted.length - 1, Math.floor(list.length / 50))]?.durationMs
}

/** Speed Index from the filmstrip: area above the "visual completeness" curve, using JPEG byte size as a cheap similarity proxy. */
function speedIndex(frames: FilmstripFrame[], fallback: number): number {
  if (frames.length < 2) return fallback
  const final = frames[frames.length - 1]
  if (!final) return fallback
  const finalSize = final.image.length
  let si = 0
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]
    const cur = frames[i]
    if (!prev || !cur) continue
    const completeness = Math.min(1, prev.image.length / finalSize)
    si += (cur.timeMs - prev.timeMs) * (1 - completeness)
  }
  return Math.round(si + (frames[0]?.timeMs ?? 0))
}

function typeOf(cdpType: string | undefined, url: string): RequestInfo['type'] {
  switch (cdpType) {
    case 'Document':
      return 'document'
    case 'Script':
      return 'script'
    case 'Stylesheet':
      return 'stylesheet'
    case 'Image':
      return 'image'
    case 'Font':
      return 'font'
    case 'Fetch':
    case 'XHR':
      return 'fetch'
    case 'WebSocket':
      return 'websocket'
    default:
      return /\.(js|mjs)(\?|$)/.test(url)
        ? 'script'
        : /\.css(\?|$)/.test(url)
          ? 'stylesheet'
          : 'other'
  }
}

function sameSite(url: string, origin: string): boolean {
  try {
    const host = new URL(url).hostname
    const root = (h: string): string => h.split('.').slice(-2).join('.')
    return host === origin || root(host) === root(origin) || /^(127\.|localhost)/.test(host)
  } catch {
    return true
  }
}

function routeOf(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return '/'
  }
}

function unitOf(id: MetricId): MetricValue['unit'] {
  if (id === 'cls') return 'ratio'
  if (id === 'jsKb' || id === 'transferKb') return 'kb'
  if (id === 'memoryMb') return 'mb'
  if (id === 'requests' || id === 'wsReconnects') return 'count'
  if (id === 'wsMessagesPerSec') return 'perSec'
  return 'ms'
}

function round(value: number, id: MetricId): number {
  return id === 'cls' ? Math.round(value * 1000) / 1000 : Math.round(value * 10) / 10
}

function emptyRun(): SingleRun {
  return {
    metrics: {},
    requests: [],
    longTasks: [],
    layoutShifts: [],
    filmstrip: [],
    features: {},
    phases: [],
  }
}
