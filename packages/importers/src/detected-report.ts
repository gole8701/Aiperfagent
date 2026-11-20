import { METRICS, PerfAgentError, median, type DetectedValue, type MetricId, type PageResult } from '@perfagent/core'

import { emptyReport, pageFromMetrics, routeOf } from './report-builder.js'
import type { ImportFormat, ImportInput, ImportResult } from './types.js'

/** Builds the result every document importer (CSV, PDF, Excel, Word, text) returns from its detected values. */
export function resultFromDetected(format: ImportFormat, detected: DetectedValue[], input: ImportInput, text: string, options: { exact?: boolean; createdAt?: string } = {}): ImportResult {
  if (detected.length === 0) {
    throw new PerfAgentError('IMPORT_INVALID', 'No metric values were found in this document.', 'Check that metric names (LCP, CLS, TTFB…) sit next to their numbers, or paste the values as text.')
  }
  const device = /\bdesktop\b/i.test(text) && !/\bmobile\b/i.test(text) ? 'desktop' : 'mobile'
  const pages = groupByRoute(detected).map(([key, metrics]) => pageFor(key, metrics, device)).slice(0, 200)
  const low = detected.filter((d) => d.confidence < 0.7)
  const warnings: string[] = []
  if (low.length) {
    const names = [...new Set(low.map((d) => METRICS[d.metric].short))].join(', ')
    warnings.push(`${low.length} value${low.length > 1 ? 's' : ''} read with low confidence (${names}). Check ${low.length > 1 ? 'them' : 'it'}.`)
  }
  const report = emptyReport(input.filename ?? 'Pasted text', {
    createdAt: options.createdAt ?? dateIn(text) ?? new Date().toISOString(),
    environment: { name: format, device, browser: 'chromium', mode: 'imported' },
    pages,
    detected: detected.slice(0, 500),
  })
  return { format, report, detected, warnings, exact: options.exact ?? false }
}

function groupByRoute(detected: DetectedValue[]): [string, Partial<Record<MetricId, number>>][] {
  const groups = new Map<string, Map<MetricId, number[]>>()
  for (const d of detected) {
    const key = d.route ?? '/'
    const metrics = groups.get(key) ?? new Map<MetricId, number[]>()
    metrics.set(d.metric, [...(metrics.get(d.metric) ?? []), d.value])
    groups.set(key, metrics)
  }
  return [...groups].map(([key, metrics]) => [key, Object.fromEntries([...metrics].map(([id, values]) => [id, median(values)])) as Partial<Record<MetricId, number>>])
}

function pageFor(key: string, metrics: Partial<Record<MetricId, number>>, device: PageResult['device']): PageResult {
  const page = pageFromMetrics(key, metrics, device)
  page.route = key.startsWith('http') ? routeOf(key) : key.startsWith('/') ? key : `/${key.replace(/\s+/g, '-')}`
  return page
}

function dateIn(text: string): string | undefined {
  const iso = /\b(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?Z?)?\b/.exec(text)
  if (!iso?.[1]) return undefined
  const parsed = Date.parse(`${iso[1]}T${iso[2] ?? '00:00'}Z`)
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString()
}
