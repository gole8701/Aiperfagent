import { percentile, type MetricId, type PageResult } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

/** `web-vitals` library / RUM export: `[{name: 'LCP', value, rating?, id?, url?}]` or `{metrics: [...]}`. */
interface VitalSample {
  name?: string
  value?: number
  url?: string
  route?: string
  page?: string
  navigationType?: string
}

const NAMES: Record<string, MetricId> = {
  LCP: 'lcp',
  INP: 'inp',
  CLS: 'cls',
  TTFB: 'ttfb',
  FCP: 'fcp',
  FID: 'inp',
}

function samplesOf(json: unknown): VitalSample[] | undefined {
  const list = Array.isArray(json) ? json : (json as { metrics?: unknown } | null)?.metrics
  if (!Array.isArray(list) || list.length === 0) return undefined
  const samples = list.filter(
    (s): s is VitalSample =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as VitalSample).name === 'string' &&
      typeof (s as VitalSample).value === 'number',
  )
  return samples.length && samples.every((s) => s.name !== undefined && s.name in NAMES)
    ? samples
    : undefined
}

export const webVitalsImporter: Importer = {
  format: 'web-vitals',
  matches: (_input, json) => samplesOf(json) !== undefined,
  run: (input, json) => {
    const byUrl = new Map<string, Map<MetricId, number[]>>()
    for (const s of samplesOf(json) ?? []) {
      const id = NAMES[s.name ?? '']
      if (!id) continue
      const url = s.url ?? s.route ?? s.page ?? '/'
      const metrics = byUrl.get(url) ?? new Map<MetricId, number[]>()
      metrics.set(id, [...(metrics.get(id) ?? []), s.value ?? 0])
      byUrl.set(url, metrics)
    }
    const pages: PageResult[] = [...byUrl].slice(0, 200).map(([url, metrics]) => {
      const p75 = Object.fromEntries(
        [...metrics].map(([id, values]) => [id, round(percentile(values, 75))]),
      ) as Partial<Record<MetricId, number>>
      const page = pageFromMetrics(url, p75, 'mobile')
      for (const m of page.metrics) {
        const values = metrics.get(m.id)
        if (values) Object.assign(m, { p75: m.value, sampleCount: values.length })
      }
      return page
    })
    const report = emptyReport(input.filename ?? 'web-vitals export', {
      environment: { name: 'rum', device: 'mobile', browser: 'chromium', mode: 'imported' },
      pages,
    })
    return Promise.resolve({
      format: 'web-vitals',
      report,
      detected: [],
      warnings: [],
      exact: true,
    })
  },
}

const round = (v: number): number => Math.round(v * 1000) / 1000
