import { METRICS, type MetricId } from '@perfagent/core'

import { unitOf } from './report-builder.js'

/** Every way a human document may name a metric: PerfAgent's names and plain labels plus common report wording. */
const EXTRA_ALIASES: [string, MetricId][] = [
  ['time to first token', 'aiFirstTokenMs'], ['first token', 'aiFirstTokenMs'], ['ttft', 'aiFirstTokenMs'],
  ['tokens per second', 'aiTokensPerSec'], ['tokens/s', 'aiTokensPerSec'], ['tokens/sec', 'aiTokensPerSec'],
  ['ai cost', 'aiCostUsd'], ['cost', 'aiCostUsd'],
  ['cache hit rate', 'aiCacheHitRate'], ['error rate', 'aiErrorRate'],
  ['javascript', 'jsKb'], ['js size', 'jsKb'], ['js bytes', 'jsKb'], ['js', 'jsKb'],
  ['page weight', 'transferKb'], ['transfer size', 'transferKb'], ['transfer', 'transferKb'], ['total bytes', 'transferKb'], ['bytes', 'transferKb'],
  ['memory', 'memoryMb'], ['heap', 'memoryMb'],
  ['perf score', 'score'],
  ['server response time', 'ttfb'],
]

export const METRIC_ALIASES: [string, MetricId][] = [
  ...Object.values(METRICS).flatMap((m): [string, MetricId][] => [[m.name, m.id], [m.short, m.id], [m.plain, m.id]]),
  ...EXTRA_ALIASES,
]
  .map(([alias, id]): [string, MetricId] => [alias.toLowerCase(), id])
  .sort((a, b) => b[0].length - a[0].length)

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** Longest alias first, so "performance score" wins over "score". Global flag: use with `matchAll` or `search`. */
export const ALIAS_PATTERNS: { id: MetricId; re: RegExp }[] = METRIC_ALIASES.map(([alias, id]) => ({ id, re: new RegExp(`(?<![a-z0-9])${escape(alias)}(?![a-z0-9])`, 'g') }))

export interface LabelMatch {
  metric: MetricId
  /** True when the whole label is a known name; false when it only contains one. */
  exact: boolean
}

/** Maps a table header or label cell to a metric: "LCP (ms)" → lcp exact, "mobile lcp" → lcp fuzzy. */
export function metricForLabel(label: string): LabelMatch | undefined {
  const cleaned = label.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned || /^[\d$.-]/.test(cleaned)) return undefined
  const exact = METRIC_ALIASES.find(([alias]) => alias === cleaned)
  if (exact) return { metric: exact[1], exact: true }
  const fuzzy = ALIAS_PATTERNS.find((p) => cleaned.search(p.re) !== -1)
  return fuzzy ? { metric: fuzzy.id, exact: false } : undefined
}

const URL_OR_PATH = /https?:\/\/[^\s|,"'<>]+|(?<![\w.])\/[\w.-][\w./-]*/

/** First URL or absolute path in a line, e.g. "Page /checkout" → "/checkout". */
export function routeInText(text: string): string | undefined {
  const m = URL_OR_PATH.exec(text)
  return m ? m[0].replace(/[.,;:)]+$/, '') : undefined
}

/** Rejects values no real page can have, e.g. a year read as a score. */
export function plausible(id: MetricId, value: number): boolean {
  if (value < 0 || !Number.isFinite(value)) return false
  switch (unitOf(id)) {
    case 'score': return value <= 100
    case 'ratio': return value <= 1
    case 'ms': return value <= 600_000
    default: return value <= 10_000_000
  }
}
