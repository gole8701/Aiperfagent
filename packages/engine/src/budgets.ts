import type { BudgetConfig, PerfAgentConfig } from '@perfagent/config'
import { METRICS, formatMetric, metricValue, type MetricId, type Report } from '@perfagent/core'

export interface BudgetResult {
  route: string
  metric: MetricId
  limit: number
  actual: number | undefined
  passed: boolean
  message: string
}

/** Checks a report against `budgets` in the config. Used by `perfagent ci` and the PR comment. */
export function checkBudgets(report: Report, budgets: PerfAgentConfig['budgets']): BudgetResult[] {
  const results: BudgetResult[] = []
  for (const [route, budget] of Object.entries(budgets)) {
    const page = report.pages.find((p) => p.route === route || p.url.endsWith(route))
    for (const [key, raw] of Object.entries(budget) as [keyof BudgetConfig, number | string | undefined][]) {
      if (raw === undefined) continue
      const metric: MetricId = key === 'js' ? 'jsKb' : key
      const limit = typeof raw === 'string' ? parseSize(raw) : raw
      const actual = page ? metricValue(page.metrics, metric) : undefined
      const lowerIsBetter = METRICS[metric].lowerIsBetter
      const passed = actual === undefined ? true : lowerIsBetter ? actual <= limit : actual >= limit
      results.push({
        route,
        metric,
        limit,
        actual,
        passed,
        message:
          actual === undefined
            ? `${route} ${METRICS[metric].short}: not measured`
            : `${route} ${METRICS[metric].short} ${formatMetric(metric, actual)} ${passed ? 'within' : 'over'} budget ${formatMetric(metric, limit)}`,
      })
    }
  }
  return results
}

function parseSize(value: string): number {
  const m = /^(\d+(?:\.\d+)?)\s?(kb|mb)$/i.exec(value)
  if (!m) return Number(value)
  const n = Number(m[1])
  return (m[2] ?? '').toLowerCase() === 'mb' ? n * 1024 : n
}

/** Markdown for a GitHub pull-request comment. */
export function budgetsMarkdown(report: Report, results: BudgetResult[]): string {
  const failed = results.filter((r) => !r.passed)
  const lines = [`## PerfAgent: ${failed.length ? `${failed.length} budget${failed.length > 1 ? 's' : ''} over limit` : 'all budgets within limits'}`, '']
  lines.push('| Page | Metric | Actual | Budget | |', '|---|---|---|---|---|')
  for (const r of results) lines.push(`| ${r.route} | ${METRICS[r.metric].short} | ${r.actual === undefined ? '—' : formatMetric(r.metric, r.actual)} | ${formatMetric(r.metric, r.limit)} | ${r.passed ? '✅' : '❌'} |`)
  const top = report.issues.filter((i) => i.status === 'open').slice(0, 5)
  if (top.length) {
    lines.push('', '### Top problems', '')
    for (const i of top) lines.push(`- **${i.plain}** ${i.location ? `(\`${i.location.file}:${i.location.line}\`)` : ''}: ${i.fix.steps[0] ?? ''}`)
  }
  return lines.join('\n')
}
