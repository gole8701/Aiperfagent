import type { RequestInfo } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

interface LighthouseAudit {
  numericValue?: number
  score?: number | null
  details?: { items?: Record<string, unknown>[] }
}
interface LighthouseReport {
  lighthouseVersion?: string
  finalUrl?: string
  finalDisplayedUrl?: string
  requestedUrl?: string
  fetchTime?: string
  configSettings?: { formFactor?: 'mobile' | 'desktop' }
  audits?: Record<string, LighthouseAudit>
  categories?: { performance?: { score?: number } }
}

const isLighthouse = (json: unknown): json is LighthouseReport => typeof json === 'object' && json !== null && 'lighthouseVersion' in json && 'audits' in json

export function fromLighthouse(lh: LighthouseReport, label = 'Lighthouse report'): ReturnType<typeof emptyReport> {
  const a = lh.audits ?? {}
  const num = (id: string): number | undefined => a[id]?.numericValue
  const url = lh.finalDisplayedUrl ?? lh.finalUrl ?? lh.requestedUrl ?? 'http://imported/'
  const requests: RequestInfo[] = ((a['network-requests']?.details?.items ?? []) as { url?: string; resourceType?: string; transferSize?: number; networkRequestTime?: number; networkEndTime?: number; statusCode?: number; isLinkPreload?: boolean; entity?: string; protocol?: string }[]).slice(0, 2000).map((r) => ({
    url: String(r.url ?? ''),
    type: mapType(r.resourceType),
    transferBytes: r.transferSize ?? 0,
    startMs: Math.round(r.networkRequestTime ?? 0),
    durationMs: Math.round((r.networkEndTime ?? 0) - (r.networkRequestTime ?? 0)),
    status: r.statusCode ?? 0,
    thirdParty: Boolean(r.entity) && !sameHost(String(r.url ?? ''), url),
    cached: false,
    protocol: r.protocol,
  }))
  const jsBytes = requests.filter((r) => r.type === 'script').reduce((s, r) => s + r.transferBytes, 0)
  const page = pageFromMetrics(url, {
    score: lh.categories?.performance?.score !== undefined && lh.categories.performance.score !== null ? Math.round(lh.categories.performance.score * 100) : undefined,
    lcp: num('largest-contentful-paint'),
    fcp: num('first-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    tbt: num('total-blocking-time'),
    si: num('speed-index'),
    ttfb: num('server-response-time'),
    inp: num('interaction-to-next-paint'),
    jsKb: jsBytes ? jsBytes / 1024 : undefined,
    requests: requests.length || undefined,
  }, lh.configSettings?.formFactor ?? 'mobile', requests)
  const lcpItem = (a['largest-contentful-paint-element']?.details?.items ?? [])[0] as { node?: { selector?: string } } | undefined
  page.lcpElement = lcpItem?.node?.selector
  return emptyReport(label, { createdAt: lh.fetchTime ?? new Date().toISOString(), environment: { name: 'lighthouse', url, device: page.device, browser: 'chromium', mode: 'imported' }, pages: [page] })
}

export const lighthouseImporter: Importer = {
  format: 'lighthouse',
  matches: (_input, json) => isLighthouse(json),
  run: (input, json) => Promise.resolve({ format: 'lighthouse', report: fromLighthouse(json as LighthouseReport, input.filename ?? 'Lighthouse report'), detected: [], warnings: [], exact: true }),
}

export const psiImporter: Importer = {
  format: 'psi',
  matches: (_input, json) => typeof json === 'object' && json !== null && 'lighthouseResult' in json,
  run: (input, json) => {
    const psi = json as { lighthouseResult: LighthouseReport; loadingExperience?: { metrics?: Record<string, { percentile?: number }> } }
    const report = fromLighthouse(psi.lighthouseResult, input.filename ?? 'PageSpeed Insights')
    const field = psi.loadingExperience?.metrics ?? {}
    const page = report.pages[0]
    if (page) {
      const map: Record<string, 'lcp' | 'inp' | 'cls' | 'ttfb' | 'fcp'> = { LARGEST_CONTENTFUL_PAINT_MS: 'lcp', INTERACTION_TO_NEXT_PAINT: 'inp', CUMULATIVE_LAYOUT_SHIFT_SCORE: 'cls', EXPERIMENTAL_TIME_TO_FIRST_BYTE: 'ttfb', FIRST_CONTENTFUL_PAINT_MS: 'fcp' }
      for (const [key, id] of Object.entries(map)) {
        const p75 = field[key]?.percentile
        const metric = page.metrics.find((m) => m.id === id)
        if (metric && p75 !== undefined) metric.p75 = id === 'cls' ? p75 / 100 : p75
      }
    }
    return Promise.resolve({ format: 'psi', report, detected: [], warnings: [], exact: true })
  },
}

function mapType(t: string | undefined): RequestInfo['type'] {
  switch (t) {
    case 'Document': return 'document'
    case 'Script': return 'script'
    case 'Stylesheet': return 'stylesheet'
    case 'Image': return 'image'
    case 'Font': return 'font'
    case 'XHR': case 'Fetch': return 'fetch'
    case 'WebSocket': return 'websocket'
    default: return 'other'
  }
}

function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).hostname === new URL(b).hostname
  } catch {
    return true
  }
}
