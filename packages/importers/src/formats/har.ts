import type { PageResult, RequestInfo } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

interface HarEntry {
  pageref?: string
  startedDateTime?: string
  time?: number
  request?: { url?: string; method?: string }
  response?: { status?: number; headersSize?: number; bodySize?: number; _transferSize?: number; content?: { mimeType?: string; size?: number; text?: unknown } }
  timings?: { wait?: number }
  _resourceType?: string
  _fromCache?: unknown
  _initiator?: { url?: string } | string
}
interface HarPage {
  id?: string
  startedDateTime?: string
  title?: string
  pageTimings?: { onContentLoad?: number; onLoad?: number; _firstContentfulPaint?: number; _firstPaint?: number; _TTFB?: number }
}
interface Har { log: { entries: HarEntry[]; pages?: HarPage[]; creator?: { name?: string } } }

const isHar = (json: unknown): json is Har => typeof json === 'object' && json !== null && 'log' in json && Array.isArray((json as { log?: { entries?: unknown } }).log?.entries)

export const harImporter: Importer = {
  format: 'har',
  matches: (_input, json) => isHar(json),
  run: (input, json) => Promise.resolve({ format: 'har', report: fromHar(json as Har, input.filename ?? 'HAR'), detected: [], warnings: [], exact: true }),
}

function fromHar(har: Har, label: string): ReturnType<typeof emptyReport> {
  const pages = har.log.pages?.length ? har.log.pages : [{ id: undefined, startedDateTime: har.log.entries[0]?.startedDateTime }]
  const results: PageResult[] = []
  for (const page of pages.slice(0, 200)) {
    const entries = har.log.entries.filter((e) => page.id === undefined || e.pageref === page.id)
    if (entries.length) results.push(pageFromEntries(page, entries))
  }
  const first = results[0]
  const created = pages[0]?.startedDateTime
  return emptyReport(label, {
    createdAt: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : new Date().toISOString(),
    environment: { name: har.log.creator?.name ?? 'har', url: first?.url, device: 'mobile', browser: 'chromium', mode: 'imported' },
    pages: results,
  })
}

function pageFromEntries(page: HarPage, entries: HarEntry[]): PageResult {
  const start = Date.parse(page.startedDateTime ?? entries[0]?.startedDateTime ?? '') || 0
  const doc = entries.find((e) => typeOf(e) === 'document') ?? entries[0]
  const url = doc?.request?.url ?? page.title ?? 'http://imported/'
  const contentLoaded = page.pageTimings?.onContentLoad
  const requests: RequestInfo[] = entries.slice(0, 5000).map((e) => {
    const type = typeOf(e)
    const startMs = Math.max(0, (Date.parse(e.startedDateTime ?? '') || start) - start)
    // Drop response bodies immediately: a 50 MB HAR is mostly content.text.
    if (e.response?.content) delete e.response.content.text
    return {
      url: e.request?.url ?? '',
      type,
      transferBytes: transferOf(e),
      startMs: Math.round(startMs),
      durationMs: Math.max(0, Math.round(e.time ?? 0)),
      status: e.response?.status ?? 0,
      thirdParty: !sameSite(e.request?.url ?? '', url),
      cached: Boolean(e._fromCache) || e.response?.status === 304,
      blocking: contentLoaded !== undefined && (type === 'script' || type === 'stylesheet') && startMs < contentLoaded ? true : undefined,
      initiator: typeof e._initiator === 'object' ? e._initiator.url : undefined,
    }
  })
  const sum = (filter: (r: RequestInfo) => boolean): number => requests.filter(filter).reduce((s, r) => s + r.transferBytes, 0)
  const timings = page.pageTimings
  return pageFromMetrics(url, {
    ttfb: doc?.timings?.wait !== undefined && doc.timings.wait >= 0 ? doc.timings.wait : timings?._TTFB,
    fcp: timings?._firstContentfulPaint ?? timings?._firstPaint,
    requests: requests.length,
    transferKb: sum(() => true) / 1024,
    jsKb: sum((r) => r.type === 'script') / 1024,
  }, 'mobile', requests)
}

function transferOf(e: HarEntry): number {
  const r = e.response
  if (!r) return 0
  if (r._transferSize !== undefined && r._transferSize >= 0) return r._transferSize
  return Math.max(0, r.headersSize ?? 0) + Math.max(0, r.bodySize ?? 0)
}

function typeOf(e: HarEntry): RequestInfo['type'] {
  const kind = (e._resourceType ?? '').toLowerCase()
  const mime = (e.response?.content?.mimeType ?? '').toLowerCase()
  if (kind === 'document' || mime.startsWith('text/html')) return 'document'
  if (kind === 'script' || mime.includes('javascript')) return 'script'
  if (kind === 'stylesheet' || mime.includes('css')) return 'stylesheet'
  if (kind === 'image' || mime.startsWith('image/')) return 'image'
  if (kind === 'font' || mime.startsWith('font/') || mime.includes('font')) return 'font'
  if (kind === 'xhr' || kind === 'fetch' || mime.includes('json')) return 'fetch'
  if (kind === 'websocket') return 'websocket'
  return 'other'
}

// shortcut: registrable domain = last two labels, which misreads co.uk-style suffixes; upgrade to a public-suffix list if that bites.
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.split('.').slice(-2).join('.')
  } catch {
    return ''
  }
}

function sameSite(a: string, b: string): boolean {
  return siteOf(a) === siteOf(b)
}
