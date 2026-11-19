import { METRICS, NOISE_RATIO, formatMetric, metricValue } from './metrics.js'
import type { Issue, MetricId, PageResult, Report } from './types.js'

export type Direction = 'better' | 'worse' | 'same'

export interface MetricDiff {
  metric: MetricId
  route: string
  from: number | undefined
  to: number | undefined
  direction: Direction
  /** Relative change, e.g. -0.38 for 38% lower. */
  change: number
  label: string
}

export interface ImpactItem {
  kind: 'fixed' | 'new' | 'still-open' | 'request' | 'unknown'
  title: string
  plain: string
  issue?: Issue
  effect: string
}

export interface Comparison {
  mode: 'before-after' | 'page-vs-page' | 'many-pages'
  sources: { id: string; label: string; createdAt: string; device: string; mode: string }[]
  verdict: { scoreFrom: number; scoreTo: number; sentences: string[] }
  diffs: MetricDiff[]
  impact: ImpactItem[]
  nextSteps: string[]
  warnings: string[]
}

const COMPARED: MetricId[] = ['score', 'lcp', 'inp', 'cls', 'ttfb', 'fcp', 'tbt', 'jsKb', 'requests', 'aiFirstTokenMs', 'aiCostUsd']

export function diffMetric(metric: MetricId, route: string, from: number | undefined, to: number | undefined): MetricDiff {
  const m = METRICS[metric]
  if (from === undefined || to === undefined) {
    return { metric, route, from, to, direction: 'same', change: 0, label: 'Not measured on both sides' }
  }
  const change = from === 0 ? (to === 0 ? 0 : 1) : (to - from) / from
  if (Math.abs(change) <= NOISE_RATIO) {
    return { metric, route, from, to, direction: 'same', change, label: 'No real change' }
  }
  const improved = m.lowerIsBetter ? to < from : to > from
  const pct = Math.round(Math.abs(change) * 100)
  const label =
    m.unit === 'score' ? `${to > from ? '+' : '−'}${Math.abs(Math.round(to - from))} points` : `${pct}% ${improved ? 'better' : 'worse'}`
  return { metric, route, from, to, direction: improved ? 'better' : 'worse', change, label }
}

function pageByRoute(report: Report, route: string): PageResult | undefined {
  return report.pages.find((p) => p.route === route) ?? report.pages[0]
}

export function compareReports(a: Report, b: Report, options: { routeA?: string; routeB?: string } = {}): Comparison {
  const pageA = options.routeA ? pageByRoute(a, options.routeA) : a.pages[0]
  const pageB = options.routeB ? pageByRoute(b, options.routeB) : b.pages[0]
  const samePage = !options.routeA || !options.routeB || options.routeA === options.routeB
  const mode: Comparison['mode'] = a.pages.length > 1 && b.pages.length > 1 && !options.routeA ? 'many-pages' : samePage ? 'before-after' : 'page-vs-page'

  const warnings = fairnessWarnings(a, b)
  const diffs: MetricDiff[] = []
  if (mode === 'many-pages') {
    for (const pa of a.pages) {
      const pb = b.pages.find((p) => p.route === pa.route)
      if (!pb) continue
      for (const metric of COMPARED) diffs.push(diffMetric(metric, pa.route, metricValue(pa.metrics, metric), metricValue(pb.metrics, metric)))
    }
  } else if (pageA && pageB) {
    for (const metric of COMPARED) diffs.push(diffMetric(metric, pageB.route, metricValue(pageA.metrics, metric), metricValue(pageB.metrics, metric)))
  }

  const scoreFrom = Math.round(average(a.pages.map((p) => metricValue(p.metrics, 'score') ?? 0)))
  const scoreTo = Math.round(average(b.pages.map((p) => metricValue(p.metrics, 'score') ?? 0)))
  const impact = findImpact(a, b, pageA, pageB)
  const sentences = verdictSentences(diffs, impact, scoreFrom, scoreTo, mode)

  return {
    mode,
    sources: [a, b].map((r) => ({ id: r.id, label: r.label ?? r.environment.name, createdAt: r.createdAt, device: r.environment.device, mode: r.environment.mode })),
    verdict: { scoreFrom, scoreTo, sentences },
    diffs: diffs.filter((d) => d.from !== undefined || d.to !== undefined),
    impact,
    nextSteps: nextSteps(diffs, impact),
    warnings,
  }
}

function fairnessWarnings(a: Report, b: Report): string[] {
  const warnings: string[] = []
  if (a.environment.device !== b.environment.device) warnings.push(`A is ${a.environment.device}, B is ${b.environment.device}. Compare the same device profile for a fair result.`)
  if (a.environment.browser !== b.environment.browser) warnings.push(`Different browsers (${a.environment.browser} vs ${b.environment.browser}).`)
  const runsA = a.pages[0]?.runs ?? 0
  const runsB = b.pages[0]?.runs ?? 0
  if (runsA && runsB && (runsA < 3 || runsB < 3)) warnings.push('One side has fewer than 3 runs; small differences may be noise.')
  if (a.detected?.length || b.detected?.length) warnings.push('One side was read from a document (PDF/Word/Excel). Check the detected values.')
  return warnings
}

function findImpact(a: Report, b: Report, pageA?: PageResult, pageB?: PageResult): ImpactItem[] {
  const items: ImpactItem[] = []
  const byRule = (issues: Issue[]): Map<string, Issue> => new Map(issues.map((i) => [`${i.ruleId}@${i.location?.file ?? i.route ?? ''}`, i]))
  const before = byRule(a.issues)
  const after = byRule(b.issues)
  for (const [key, issue] of before) {
    if (!after.has(key)) items.push({ kind: 'fixed', title: issue.title, plain: issue.plain, issue, effect: `${METRICS[issue.gain.metric].short} ${formatMetric(issue.gain.metric, issue.gain.from)} → ~${formatMetric(issue.gain.metric, issue.gain.to)}` })
  }
  for (const [key, issue] of after) {
    if (!before.has(key)) items.push({ kind: 'new', title: issue.title, plain: issue.plain, issue, effect: `costs about ${issue.gain.scoreDelta} points` })
    else items.push({ kind: 'still-open', title: issue.title, plain: issue.plain, issue, effect: `still costs about ${issue.gain.scoreDelta} points` })
  }
  if (pageA && pageB && pageA.requests.length && pageB.requests.length) {
    const urlsA = new Set(pageA.requests.map((r) => r.url))
    for (const r of pageB.requests) {
      if (!urlsA.has(r.url) && r.transferBytes > 50_000) {
        items.push({ kind: 'request', title: `New download: ${r.url.split('/').pop() ?? r.url}`, plain: `A new file of ${formatMetric('transferKb', r.transferBytes / 1024)} is now loaded`, effect: r.thirdParty ? 'third-party script' : 'new asset' })
      }
    }
  }
  if (items.length === 0 && (a.issues.length === 0 || b.issues.length === 0)) {
    items.push({ kind: 'unknown', title: 'Cause unknown', plain: 'One side has only numbers, no scan details. Re-scan to find the cause.', effect: '' })
  }
  return items.sort((x, y) => rank(x.kind) - rank(y.kind))
}

function rank(kind: ImpactItem['kind']): number {
  return { new: 0, 'still-open': 1, request: 2, fixed: 3, unknown: 4 }[kind]
}

function verdictSentences(diffs: MetricDiff[], impact: ImpactItem[], from: number, to: number, mode: Comparison['mode']): string[] {
  const better = diffs.filter((d) => d.direction === 'better' && d.metric !== 'score')
  const worse = diffs.filter((d) => d.direction === 'worse' && d.metric !== 'score')
  const out: string[] = []
  if (mode === 'page-vs-page') out.push(`The second page scores ${to} against ${from}.`)
  else if (to > from + 2) out.push(`Overall it got better: ${from} → ${to} points.`)
  else if (to < from - 2) out.push(`Overall it got worse: ${from} → ${to} points.`)
  else out.push(`No real change overall (${from} → ${to}).`)
  if (better.length) out.push(`Improved: ${better.slice(0, 3).map((d) => `${METRICS[d.metric].short} ${d.label}`).join(', ')}.`)
  if (worse.length) out.push(`Got worse: ${worse.slice(0, 3).map((d) => `${METRICS[d.metric].short} ${d.label}`).join(', ')}.`)
  const first = impact.find((i) => i.kind === 'new' || i.kind === 'still-open')
  if (first) out.push(`Fix first: ${first.plain}.`)
  return out
}

function nextSteps(diffs: MetricDiff[], impact: ImpactItem[]): string[] {
  const steps: string[] = []
  const regressions = impact.filter((i) => i.kind === 'new')
  if (regressions.length) steps.push(`Fix the ${regressions.length} new problem${regressions.length > 1 ? 's' : ''} (start with "${regressions[0]?.plain ?? ''}")`)
  const worse = diffs.filter((d) => d.direction === 'worse')
  if (worse.length) steps.push(`Add budgets for ${worse.map((d) => METRICS[d.metric].short).join(', ')} so they cannot get worse again`)
  steps.push('Save this scan as the new baseline')
  return steps
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}
