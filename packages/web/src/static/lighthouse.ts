import type { Area, Issue, MetricId, MetricValue, PageResult, Report, RequestInfo, Severity } from '@perfagent/core'
import { METRICS } from '@perfagent/core'

/**
 * Browser-side converter for a Lighthouse result (LHR) or a PageSpeed Insights
 * response, so the website can show any Lighthouse JSON on the same screens.
 */
interface AuditDetailItem {
  url?: string
  resourceType?: string
  transferSize?: number
  networkRequestTime?: number
  networkEndTime?: number
  statusCode?: number
  protocol?: string
  entity?: string
  timing?: number
  data?: string
  totalBytes?: number
  wastedBytes?: number
  node?: { snippet?: string; selector?: string }
}

interface Audit {
  id: string
  title: string
  description?: string
  score: number | null
  numericValue?: number
  displayValue?: string
  metricSavings?: Partial<Record<'LCP' | 'FCP' | 'TBT' | 'CLS' | 'INP', number>>
  details?: { type?: string; items?: AuditDetailItem[]; overallSavingsMs?: number }
}

export interface Lighthouse {
  lighthouseVersion?: string
  requestedUrl?: string
  finalDisplayedUrl?: string
  finalUrl?: string
  fetchTime?: string
  configSettings?: { formFactor?: 'mobile' | 'desktop' }
  categories?: { performance?: { score: number | null } }
  audits: Record<string, Audit>
}

export function isLighthouseJson(data: unknown): data is Lighthouse | { lighthouseResult: Lighthouse } {
  if (!data || typeof data !== 'object') return false
  const d = data as { audits?: unknown; lighthouseResult?: { audits?: unknown } }
  return typeof d.audits === 'object' || typeof d.lighthouseResult?.audits === 'object'
}

const METRIC_AUDITS: [MetricId, string][] = [
  ['lcp', 'largest-contentful-paint'],
  ['inp', 'interaction-to-next-paint'],
  ['cls', 'cumulative-layout-shift'],
  ['ttfb', 'server-response-time'],
  ['fcp', 'first-contentful-paint'],
  ['tbt', 'total-blocking-time'],
  ['si', 'speed-index'],
]

const AUDIT_AREAS: Record<string, Area[]> = {
  'render-blocking-resources': ['css', 'javascript'],
  'unused-javascript': ['unused-code', 'bundle'],
  'unused-css-rules': ['unused-code', 'css'],
  'uses-responsive-images': ['images'],
  'offscreen-images': ['images'],
  'modern-image-formats': ['images'],
  'uses-optimized-images': ['images'],
  'font-display': ['fonts'],
  'uses-long-cache-ttl': ['caching'],
  'uses-text-compression': ['network', 'server'],
  'third-party-summary': ['third-party'],
  'mainthread-work-breakdown': ['javascript'],
  'bootup-time': ['javascript'],
  'largest-contentful-paint-element': ['images', 'rendering'],
  'layout-shifts': ['rendering'],
  'prioritize-lcp-image': ['images'],
}

export function convertLighthouse(input: Lighthouse | { lighthouseResult: Lighthouse }): Report {
  const lhr = 'lighthouseResult' in input ? input.lighthouseResult : input
  const url = lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl ?? 'https://example.com/'
  const route = safeRoute(url)
  const metrics = metricValues(lhr)
  const page: PageResult = {
    url,
    route,
    device: lhr.configSettings?.formFactor ?? 'mobile',
    runs: 1,
    metrics,
    phases: phases(metrics),
    requests: requests(lhr, url),
    longTasks: [],
    layoutShifts: [],
    filmstrip: (lhr.audits['screenshot-thumbnails']?.details?.items ?? []).map((f) => ({ timeMs: f.timing ?? 0, image: f.data ?? '' })),
    lcpElement: lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.selector,
    coverage: coverage(lhr),
  }
  const id = `lh-${Math.random().toString(36).slice(2, 10)}`
  return {
    schemaVersion: 1,
    tool: { name: 'perfagent', version: `lighthouse-${lhr.lighthouseVersion ?? 'unknown'}` },
    id,
    createdAt: lhr.fetchTime ?? new Date().toISOString(),
    environment: { name: 'lighthouse', url, device: page.device, browser: 'chromium', mode: 'imported' },
    pages: [page],
    issues: issues(lhr, route),
    label: `Lighthouse · ${route}`,
  }
}

function metricValues(lhr: Lighthouse): MetricValue[] {
  const values: MetricValue[] = []
  for (const [id, auditId] of METRIC_AUDITS) {
    const value = lhr.audits[auditId]?.numericValue
    if (typeof value === 'number') values.push({ id, value, unit: METRICS[id].unit })
  }
  const score = lhr.categories?.performance?.score
  if (typeof score === 'number') values.push({ id: 'score', value: Math.round(score * 100), unit: 'score' })
  const items = lhr.audits['network-requests']?.details?.items ?? []
  if (items.length) {
    values.push({ id: 'requests', value: items.length, unit: 'count' })
    values.push({ id: 'transferKb', value: sum(items.map((i) => i.transferSize ?? 0)) / 1024, unit: 'kb' })
    values.push({ id: 'jsKb', value: sum(items.filter((i) => i.resourceType === 'Script').map((i) => i.transferSize ?? 0)) / 1024, unit: 'kb' })
  }
  return values
}

function phases(metrics: MetricValue[]): PageResult['phases'] {
  const get = (id: MetricId): number => metrics.find((m) => m.id === id)?.value ?? 0
  const ttfb = get('ttfb')
  const fcp = get('fcp')
  const lcp = get('lcp')
  return [
    { phase: 'server', ms: ttfb },
    { phase: 'download', ms: Math.max(0, fcp - ttfb) },
    { phase: 'script', ms: get('tbt') },
    { phase: 'render', ms: Math.max(0, lcp - fcp) },
  ]
}

function requests(lhr: Lighthouse, pageUrl: string): RequestInfo[] {
  const host = hostOf(pageUrl)
  const items = lhr.audits['network-requests']?.details?.items ?? []
  return items
    .filter((i) => i.url)
    .map((i) => ({
      url: i.url ?? '',
      type: requestType(i.resourceType),
      transferBytes: i.transferSize ?? 0,
      startMs: i.networkRequestTime ?? 0,
      durationMs: Math.max(0, (i.networkEndTime ?? 0) - (i.networkRequestTime ?? 0)),
      status: i.statusCode ?? 0,
      thirdParty: hostOf(i.url ?? '') !== host,
      cached: false,
      protocol: i.protocol,
    }))
}

function requestType(resourceType: string | undefined): RequestInfo['type'] {
  switch (resourceType) {
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
    case 'XHR':
    case 'Fetch':
      return 'fetch'
    case 'WebSocket':
      return 'websocket'
    default:
      return 'other'
  }
}

function coverage(lhr: Lighthouse): PageResult['coverage'] {
  const rows = [...(lhr.audits['unused-javascript']?.details?.items ?? []), ...(lhr.audits['unused-css-rules']?.details?.items ?? [])]
  return rows.filter((r) => r.url && r.totalBytes).map((r) => ({ url: r.url ?? '', totalBytes: r.totalBytes ?? 0, unusedBytes: r.wastedBytes ?? 0 }))
}

function issues(lhr: Lighthouse, route: string): Issue[] {
  const out: Issue[] = []
  for (const audit of Object.values(lhr.audits)) {
    if (audit.score === null || audit.score >= 0.9) continue
    const isOpportunity = audit.details?.type === 'opportunity' || Boolean(audit.metricSavings)
    if (!isOpportunity && !AUDIT_AREAS[audit.id]) continue
    const savingsMs = audit.details?.overallSavingsMs ?? audit.metricSavings?.LCP ?? audit.metricSavings?.TBT ?? audit.metricSavings?.FCP ?? 0
    const metric = gainMetric(audit)
    const from = lhr.audits[METRIC_AUDITS.find(([m]) => m === metric)?.[1] ?? '']?.numericValue ?? 0
    out.push({
      id: `lighthouse/${audit.id}@${route}`,
      ruleId: `lighthouse/${audit.id}`,
      title: audit.title,
      plain: audit.title,
      severity: severity(audit.score),
      metrics: [metric],
      areas: AUDIT_AREAS[audit.id] ?? ['network'],
      route,
      chain: [{ kind: 'metric', label: `${METRICS[metric].short} ${audit.displayValue ?? ''}`.trim() }, ...(audit.details?.items?.[0]?.url ? [{ kind: 'request' as const, label: audit.details.items[0].url }] : [])],
      why: stripMarkdown(audit.description ?? ''),
      gain: { metric, from, to: metric === 'cls' ? Math.max(0, from - (audit.metricSavings?.CLS ?? 0)) : Math.max(0, from - savingsMs), scoreDelta: Math.min(15, Math.round(savingsMs / 300)), note: 'estimate from Lighthouse savings' },
      fix: { steps: [stripMarkdown(audit.description ?? '').split('. ')[0] ?? audit.title], changes: [], automatic: false },
      docs: docLinks(audit.description ?? ''),
      status: 'open',
      confidence: 0.6,
    })
  }
  return out.sort((a, b) => b.gain.scoreDelta - a.gain.scoreDelta)
}

function gainMetric(audit: Audit): MetricId {
  const s = audit.metricSavings ?? {}
  if ((s.LCP ?? 0) > 0) return 'lcp'
  if ((s.TBT ?? 0) > 0) return 'tbt'
  if ((s.CLS ?? 0) > 0) return 'cls'
  if ((s.INP ?? 0) > 0) return 'inp'
  if ((s.FCP ?? 0) > 0) return 'fcp'
  return audit.id.includes('layout') ? 'cls' : 'lcp'
}

function severity(score: number): Severity {
  if (score < 0.5) return 'critical'
  return score < 0.9 ? 'warning' : 'info'
}

function stripMarkdown(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '')
}

function docLinks(text: string): Issue['docs'] {
  const links: Issue['docs'] = []
  for (const match of text.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)) links.push({ label: match[1] ?? 'Docs', url: match[2] ?? '' })
  return links
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function safeRoute(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return '/'
  }
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
