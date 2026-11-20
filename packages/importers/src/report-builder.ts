import {
  computeScore,
  shortId,
  type DetectedValue,
  type MetricId,
  type MetricValue,
  type PageResult,
  type Report,
  type RequestInfo,
} from '@perfagent/core'

/** Helpers every importer uses to assemble a valid, minimal Report. */
export function emptyReport(label: string, extra: Partial<Report> = {}): Report {
  return {
    schemaVersion: 1,
    tool: { name: 'perfagent', version: 'import' },
    id: shortId('import'),
    createdAt: new Date().toISOString(),
    environment: { name: 'imported', device: 'mobile', browser: 'chromium', mode: 'imported' },
    pages: [],
    issues: [],
    label,
    ...extra,
  }
}

export function pageFromMetrics(
  url: string,
  metrics: Partial<Record<MetricId, number>>,
  device: 'mobile' | 'desktop' = 'mobile',
  requests: RequestInfo[] = [],
): PageResult {
  const list: MetricValue[] = []
  for (const [id, value] of Object.entries(metrics) as [MetricId, number | undefined][]) {
    if (value === undefined || Number.isNaN(value)) continue
    list.push({ id, value, unit: unitOf(id) })
  }
  if (!list.some((m) => m.id === 'score'))
    list.push({ id: 'score', value: computeScore(list), unit: 'score' })
  return {
    url,
    route: routeOf(url),
    device,
    runs: 1,
    metrics: list,
    phases: [],
    requests,
    longTasks: [],
    layoutShifts: [],
    filmstrip: [],
  }
}

export function detectedFrom(
  metrics: Partial<Record<MetricId, number>>,
  confidence: number,
  source: string,
  route?: string,
): DetectedValue[] {
  return (Object.entries(metrics) as [MetricId, number | undefined][])
    .filter((e): e is [MetricId, number] => e[1] !== undefined)
    .map(([metric, value]) => ({ metric, value, route, confidence, source }))
}

export function unitOf(id: MetricId): MetricValue['unit'] {
  switch (id) {
    case 'score':
    case 'agentReadiness':
      return 'score'
    case 'cls':
    case 'aiCacheHitRate':
    case 'aiErrorRate':
      return 'ratio'
    case 'jsKb':
    case 'transferKb':
      return 'kb'
    case 'memoryMb':
      return 'mb'
    case 'requests':
    case 'wsReconnects':
      return 'count'
    case 'aiCostUsd':
      return 'usd'
    case 'aiTokensPerSec':
    case 'wsMessagesPerSec':
      return 'perSec'
    default:
      return 'ms'
  }
}

export function routeOf(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return url.startsWith('/') ? url : '/'
  }
}

/** Reads a number from a human-written value: "3.4 s", "350ms", "1,200", "0.12", "72/100". */
export function parseHumanNumber(raw: string, metric: MetricId): number | undefined {
  const text = raw.replace(/,/g, '').trim()
  const m = /(-?\d+(?:\.\d+)?)\s*(ms|s|sec|seconds|kb|mb|%)?/i.exec(text)
  if (!m) return undefined
  let value = Number(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  const target = unitOf(metric)
  if (
    target === 'ms' &&
    (unit === 's' || unit === 'sec' || unit === 'seconds' || (unit === '' && value < 30))
  )
    value *= 1000
  if (target === 'kb' && unit === 'mb') value *= 1024
  if (target === 'ratio' && (unit === '%' || value > 1)) value /= 100
  return value
}
