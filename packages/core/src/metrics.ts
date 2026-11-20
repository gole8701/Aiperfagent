import type { MetricId, MetricUnit, MetricValue } from './types.js'

export interface MetricDefinition {
  id: MetricId
  name: string
  short: string
  unit: MetricUnit
  /** One plain sentence a non-technical person understands. */
  plain: string
  /** Everything ≤ good is green, ≤ poor is amber, above is red. `null` means "lower is better, no fixed threshold". */
  good: number | null
  poor: number | null
  /** False for things like tokens/sec where higher is better. */
  lowerIsBetter: boolean
  /** Guide topic opened by the "i" button. */
  guide: string
}

const def = (d: MetricDefinition): MetricDefinition => d

export const METRICS: Record<MetricId, MetricDefinition> = {
  score: def({
    id: 'score',
    name: 'Performance score',
    short: 'Score',
    unit: 'score',
    plain: 'One 0–100 summary of how fast the page is',
    good: 90,
    poor: 50,
    lowerIsBetter: false,
    guide: 'score',
  }),
  lcp: def({
    id: 'lcp',
    name: 'Largest Contentful Paint',
    short: 'LCP',
    unit: 'ms',
    plain: 'Time until the main content is visible',
    good: 2500,
    poor: 4000,
    lowerIsBetter: true,
    guide: 'lcp',
  }),
  inp: def({
    id: 'inp',
    name: 'Interaction to Next Paint',
    short: 'INP',
    unit: 'ms',
    plain: 'Delay after a tap or click before the screen reacts',
    good: 200,
    poor: 500,
    lowerIsBetter: true,
    guide: 'inp',
  }),
  cls: def({
    id: 'cls',
    name: 'Cumulative Layout Shift',
    short: 'CLS',
    unit: 'ratio',
    plain: 'How much the page jumps around while loading',
    good: 0.1,
    poor: 0.25,
    lowerIsBetter: true,
    guide: 'cls',
  }),
  ttfb: def({
    id: 'ttfb',
    name: 'Time to First Byte',
    short: 'TTFB',
    unit: 'ms',
    plain: 'Time until the server starts answering',
    good: 800,
    poor: 1800,
    lowerIsBetter: true,
    guide: 'ttfb',
  }),
  fcp: def({
    id: 'fcp',
    name: 'First Contentful Paint',
    short: 'FCP',
    unit: 'ms',
    plain: 'Time until anything appears on screen',
    good: 1800,
    poor: 3000,
    lowerIsBetter: true,
    guide: 'fcp',
  }),
  tbt: def({
    id: 'tbt',
    name: 'Total Blocking Time',
    short: 'TBT',
    unit: 'ms',
    plain: 'Time the page is too busy to respond while loading',
    good: 200,
    poor: 600,
    lowerIsBetter: true,
    guide: 'tbt',
  }),
  si: def({
    id: 'si',
    name: 'Speed Index',
    short: 'SI',
    unit: 'ms',
    plain: 'How quickly the visible part of the page fills in',
    good: 3400,
    poor: 5800,
    lowerIsBetter: true,
    guide: 'score',
  }),
  jsKb: def({
    id: 'jsKb',
    name: 'JavaScript size',
    short: 'JS',
    unit: 'kb',
    plain: 'Amount of JavaScript downloaded and run',
    good: 200,
    poor: 500,
    lowerIsBetter: true,
    guide: 'bundle',
  }),
  requests: def({
    id: 'requests',
    name: 'Requests',
    short: 'Requests',
    unit: 'count',
    plain: 'Number of files the page loads',
    good: 50,
    poor: 120,
    lowerIsBetter: true,
    guide: 'bundle',
  }),
  transferKb: def({
    id: 'transferKb',
    name: 'Total download',
    short: 'Download',
    unit: 'kb',
    plain: 'Total data the page downloads',
    good: 1500,
    poor: 4000,
    lowerIsBetter: true,
    guide: 'bundle',
  }),
  memoryMb: def({
    id: 'memoryMb',
    name: 'Memory (JS heap)',
    short: 'Memory',
    unit: 'mb',
    plain: 'Memory the page keeps using over time',
    good: 50,
    poor: 150,
    lowerIsBetter: true,
    guide: 'memory',
  }),
  wsReconnects: def({
    id: 'wsReconnects',
    name: 'WebSocket reconnects',
    short: 'Reconnects',
    unit: 'count',
    plain: 'How often the live connection drops and reconnects',
    good: 2,
    poor: 10,
    lowerIsBetter: true,
    guide: 'live',
  }),
  wsMessagesPerSec: def({
    id: 'wsMessagesPerSec',
    name: 'WebSocket messages / sec',
    short: 'Msg/s',
    unit: 'perSec',
    plain: 'Live messages per second',
    good: null,
    poor: null,
    lowerIsBetter: true,
    guide: 'live',
  }),
  aiFirstTokenMs: def({
    id: 'aiFirstTokenMs',
    name: 'AI first token',
    short: 'First token',
    unit: 'ms',
    plain: 'Time until the first word of an AI answer appears',
    good: 1000,
    poor: 3000,
    lowerIsBetter: true,
    guide: 'ai-first-token',
  }),
  aiTokensPerSec: def({
    id: 'aiTokensPerSec',
    name: 'AI tokens / sec',
    short: 'Tokens/s',
    unit: 'perSec',
    plain: 'How smoothly AI answers stream in',
    good: 30,
    poor: 10,
    lowerIsBetter: false,
    guide: 'ai-first-token',
  }),
  aiCostUsd: def({
    id: 'aiCostUsd',
    name: 'AI cost',
    short: 'AI cost',
    unit: 'usd',
    plain: 'Money spent on AI',
    good: null,
    poor: null,
    lowerIsBetter: true,
    guide: 'ai-cost',
  }),
  aiCacheHitRate: def({
    id: 'aiCacheHitRate',
    name: 'AI cache hit rate',
    short: 'Cache',
    unit: 'ratio',
    plain: 'Share of the AI prompt served from cache',
    good: 0.7,
    poor: 0.3,
    lowerIsBetter: false,
    guide: 'ai-cost',
  }),
  aiErrorRate: def({
    id: 'aiErrorRate',
    name: 'AI error rate',
    short: 'AI errors',
    unit: 'ratio',
    plain: 'Share of AI calls that failed or were rate limited',
    good: 0.01,
    poor: 0.05,
    lowerIsBetter: true,
    guide: 'measure-ai',
  }),
  agentReadiness: def({
    id: 'agentReadiness',
    name: 'Agent readiness',
    short: 'Agents',
    unit: 'score',
    plain: 'How easily AI assistants can use your site',
    good: 80,
    poor: 50,
    lowerIsBetter: false,
    guide: 'agent-readiness',
  }),
}

export const CORE_WEB_VITALS: MetricId[] = ['lcp', 'inp', 'cls', 'ttfb', 'fcp', 'tbt']

export type Rating = 'good' | 'needs-work' | 'poor' | 'none'

export function rateMetric(id: MetricId, value: number): Rating {
  const m = METRICS[id]
  if (m.good === null || m.poor === null) return 'none'
  if (m.lowerIsBetter) {
    if (value <= m.good) return 'good'
    return value <= m.poor ? 'needs-work' : 'poor'
  }
  if (value >= m.good) return 'good'
  return value >= m.poor ? 'needs-work' : 'poor'
}

export function formatMetric(id: MetricId, value: number): string {
  const unit = METRICS[id].unit
  switch (unit) {
    case 'ms':
      return value >= 1000
        ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`
        : `${Math.round(value)} ms`
    case 'score':
      return `${Math.round(value)}`
    case 'kb':
      return value >= 1024 ? `${(value / 1024).toFixed(1)} MB` : `${Math.round(value)} KB`
    case 'mb':
      return `${Math.round(value)} MB`
    case 'ratio':
      return id === 'cls' ? value.toFixed(2) : `${Math.round(value * 100)}%`
    case 'usd':
      return value < 0.1 ? `$${value.toFixed(3)}` : `$${value.toFixed(2)}`
    case 'perSec':
      return `${Math.round(value)}/s`
    case 'count':
      return `${Math.round(value)}`
  }
}

export function metricValue(values: MetricValue[], id: MetricId): number | undefined {
  return values.find((m) => m.id === id)?.value
}

export function median(samples: number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

/** Run-to-run noise band. Differences inside it are reported as "no real change". */
export const NOISE_RATIO = 0.04
