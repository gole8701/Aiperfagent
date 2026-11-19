import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { attachIssues, compareReports, computeScore, countChips, countNodes, diffMetric, formatMetric, matchesChip, median, metricScore, pathTo, percentile, projectedScore, rateMetric, summarise, type Issue, type Report, type TreeNode } from '../src/index.js'

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/reports/demo-shop-before.json')

async function loadReport(): Promise<Report> {
  return JSON.parse(await readFile(fixture, 'utf8')) as Report
}

describe('metrics', () => {
  it('rates against Core Web Vitals thresholds', () => {
    expect(rateMetric('lcp', 2000)).toBe('good')
    expect(rateMetric('lcp', 3000)).toBe('needs-work')
    expect(rateMetric('lcp', 5000)).toBe('poor')
    expect(rateMetric('aiCacheHitRate', 0.9)).toBe('good')
    expect(rateMetric('aiCacheHitRate', 0.1)).toBe('poor')
    expect(rateMetric('aiCostUsd', 5)).toBe('none')
  })

  it('formats values in human units', () => {
    expect(formatMetric('lcp', 3400)).toBe('3.4 s')
    expect(formatMetric('inp', 210)).toBe('210 ms')
    expect(formatMetric('cls', 0.123)).toBe('0.12')
    expect(formatMetric('jsKb', 1996.7)).toBe('1.9 MB')
    expect(formatMetric('aiCostUsd', 0.011)).toBe('$0.011')
    expect(formatMetric('aiCacheHitRate', 0.7)).toBe('70%')
  })

  it('median and percentile ignore order', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10)
    expect(percentile([], 50)).toBe(0)
  })
})

describe('score', () => {
  it('maps good metrics high and poor metrics low', () => {
    expect(metricScore('lcp', 1200)).toBeGreaterThanOrEqual(95)
    expect(metricScore('lcp', 4000)).toBeLessThanOrEqual(55)
    const good = computeScore([{ id: 'lcp', value: 1500, unit: 'ms' }, { id: 'tbt', value: 50, unit: 'ms' }, { id: 'cls', value: 0.01, unit: 'ratio' }, { id: 'fcp', value: 900, unit: 'ms' }, { id: 'si', value: 1500, unit: 'ms' }])
    const bad = computeScore([{ id: 'lcp', value: 6000, unit: 'ms' }, { id: 'tbt', value: 1200, unit: 'ms' }, { id: 'cls', value: 0.4, unit: 'ratio' }, { id: 'fcp', value: 4000, unit: 'ms' }, { id: 'si', value: 8000, unit: 'ms' }])
    expect(good).toBeGreaterThanOrEqual(90)
    expect(bad).toBeLessThan(30)
  })

  it('projects a higher score when issues are fixed, capped at 100', () => {
    const issue = { status: 'open', gain: { scoreDelta: 11 } } as Issue
    expect(projectedScore(72, [issue, issue])).toBeGreaterThan(72)
    expect(projectedScore(99, [issue, issue, issue])).toBe(100)
  })
})

describe('compare', () => {
  it('treats small differences as no real change', () => {
    expect(diffMetric('lcp', '/', 3000, 3050).direction).toBe('same')
    expect(diffMetric('lcp', '/', 3000, 1900)).toMatchObject({ direction: 'better', label: '37% better' })
    expect(diffMetric('lcp', '/', 1900, 3000).direction).toBe('worse')
    expect(diffMetric('score', '/', 72, 96).label).toBe('+24 points')
  })

  it('finds fixed, new and still-open problems between two reports', async () => {
    const before = await loadReport()
    const after: Report = { ...before, id: 'after', issues: before.issues.slice(1), pages: before.pages.map((p) => ({ ...p, metrics: p.metrics.map((m) => (m.id === 'lcp' ? { ...m, value: m.value * 0.5 } : m)) })) }
    const result = compareReports(before, after)
    expect(result.mode).toBe('before-after')
    expect(result.impact.some((i) => i.kind === 'fixed')).toBe(true)
    expect(result.impact.filter((i) => i.kind === 'still-open').length).toBe(after.issues.length)
    expect(result.diffs.find((d) => d.metric === 'lcp')?.direction).toBe('better')
    expect(result.verdict.sentences.length).toBeGreaterThan(0)
  })

  it('warns when device profiles differ', async () => {
    const a = await loadReport()
    const b: Report = { ...a, environment: { ...a.environment, device: 'desktop' } }
    expect(compareReports(a, b).warnings.join(' ')).toMatch(/mobile.*desktop/)
  })
})

describe('plain language and chips', () => {
  it('summarises a report without AI', async () => {
    const report = await loadReport()
    const s = summarise(report)
    expect(s.headline.length).toBeGreaterThan(5)
    expect(s.topIssues.length).toBeLessThanOrEqual(3)
    expect(s.sentences.some((t) => t.startsWith('Start with:'))).toBe(true)
  })

  it('counts chips and filters consistently', async () => {
    const report = await loadReport()
    const chips = countChips(report.issues)
    expect(chips.total).toBe(report.issues.filter((i) => i.status === 'open').length)
    const lcp = report.issues.filter((i) => matchesChip(i, { kind: 'metric', id: 'lcp' })).length
    expect(chips.metrics.lcp ?? 0).toBe(lcp)
  })
})

describe('tree', () => {
  it('attaches issues to the deepest node and counts up to parents', () => {
    const file: TreeNode = { id: 'f', name: 'a.tsx', kind: 'file', path: 'src/a.tsx', tag: 'TSX', issueIds: [], counts: { critical: 0, warning: 0, info: 0 }, children: [{ id: 'c', name: 'A', kind: 'component', path: 'src/a.tsx', line: 3, tag: '<>', issueIds: [], counts: { critical: 0, warning: 0, info: 0 }, children: [] }] }
    const root: TreeNode = { id: 'r', name: 'root', kind: 'root', path: '', tag: 'ROOT', issueIds: [], counts: { critical: 0, warning: 0, info: 0 }, children: [{ id: 'd', name: 'src', kind: 'dir', path: 'src', tag: 'DIR', issueIds: [], counts: { critical: 0, warning: 0, info: 0 }, children: [file] }] }
    const issue = { id: 'x', severity: 'critical', location: { file: 'src/a.tsx', line: 10 } } as Issue
    attachIssues(root, [issue])
    expect(file.children[0]?.issueIds).toEqual(['x'])
    expect(root.counts.critical).toBe(1)
    expect(pathTo(root, 'c').map((n) => n.id)).toEqual(['r', 'd', 'f', 'c'])
    expect(countNodes(root)).toBe(4)
  })
})
