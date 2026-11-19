import { METRICS, formatMetric, metricValue, rateMetric } from './metrics.js'
import { projectedScore } from './score.js'
import type { Issue, PageResult, Report, TimelinePhase } from './types.js'

/**
 * "In simple words": text generated from data alone, no AI needed.
 */
export interface Summary {
  headline: string
  sentences: string[]
  topIssues: Issue[]
  scoreNow: number
  scoreAfterFixes: number
}

export function summarise(report: Report, route?: string): Summary {
  const page = route ? report.pages.find((p) => p.route === route) : report.pages[0]
  const issues = report.issues.filter((i) => i.status === 'open' && (!route || !i.route || i.route === route))
  const ranked = [...issues].sort((a, b) => b.gain.scoreDelta - a.gain.scoreDelta)
  const scoreNow = page ? (metricValue(page.metrics, 'score') ?? 0) : 0
  const topThree = ranked.slice(0, 3)
  const afterTop = projectedScore(scoreNow, topThree)
  const afterAll = projectedScore(scoreNow, ranked)

  const sentences: string[] = []
  if (page) sentences.push(describePage(page))
  if (topThree.length) {
    sentences.push(`Fixing the top ${topThree.length} problem${topThree.length > 1 ? 's' : ''} gives about +${afterTop - scoreNow} points.`)
    sentences.push(`Start with: ${topThree[0]?.plain ?? ''}.`)
  } else {
    sentences.push('No problems found. Keep budgets on so it stays that way.')
  }
  return {
    headline: headline(scoreNow, issues.length),
    sentences,
    topIssues: topThree,
    scoreNow,
    scoreAfterFixes: afterAll,
  }
}

function headline(score: number, issueCount: number): string {
  if (score >= 90) return issueCount ? 'Fast, with a few things to tidy up' : 'Fast and healthy'
  if (score >= 50) return `Usable, but ${issueCount} thing${issueCount === 1 ? '' : 's'} slow it down`
  return 'Slow: visitors will notice'
}

function describePage(page: PageResult): string {
  const parts: string[] = []
  for (const id of ['lcp', 'inp', 'cls'] as const) {
    const value = metricValue(page.metrics, id)
    if (value === undefined) continue
    const rating = rateMetric(id, value)
    if (rating === 'good') continue
    parts.push(`${lowerFirst(METRICS[id].plain)} is ${formatMetric(id, value)} (${rating === 'poor' ? 'poor' : 'needs work'})`)
  }
  return parts.length ? `Right now ${parts.join('; ')}.` : 'All Core Web Vitals are in the green.'
}

export function describePhases(phases: TimelinePhase[]): string {
  if (phases.length === 0) return ''
  const biggest = [...phases].sort((a, b) => b.ms - a.ms)[0]
  if (!biggest) return ''
  const names = { server: 'waiting for the server', download: 'downloading files', script: 'running scripts', render: 'drawing the page' }
  return `Biggest part: ${names[biggest.phase]} (${formatMetric('lcp', biggest.ms)}).`
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
