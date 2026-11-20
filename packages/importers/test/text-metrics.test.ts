import { describe, expect, it } from 'vitest'

import { metricForLabel } from '../src/metric-aliases.js'
import { looksLikeReportLink } from '../src/report-link.js'
import { detectMetricsInText } from '../src/text-metrics.js'

const detect = (text: string) =>
  detectMetricsInText(text, 'test').map(({ metric, value, route, confidence }) => ({
    metric,
    value,
    route,
    confidence,
  }))

describe('detectMetricsInText', () => {
  it.each([
    ['CLS 0.12', 'cls', 0.12],
    ['LCP: 3.4s', 'lcp', 3400],
    ['Time to first byte — 820 ms', 'ttfb', 820],
    ['Score 72/100', 'score', 72],
    ['First token 1.2 s', 'aiFirstTokenMs', 1200],
    ['Cost $0.011', 'aiCostUsd', 0.011],
    ['Largest Contentful Paint 3.4 s', 'lcp', 3400],
    ['Interaction to Next Paint: 210 ms', 'inp', 210],
    ['Total blocking time 1,250 ms', 'tbt', 1250],
    ['JavaScript 1.2 MB', 'jsKb', 1228.8],
    ['Time until the main content is visible: 2.5 s', 'lcp', 2500],
    ['Speed Index 4.0 s', 'si', 4000],
  ])('reads %s', (line, metric, value) => {
    expect(detect(line)).toEqual([{ metric, value, route: undefined, confidence: 0.85 }])
  })

  it('lowers confidence when the value sits far from the name', () => {
    const hits = detect(
      'Largest Contentful Paint is the time the biggest element takes to show up and here it is 3.4 s',
    )
    expect(hits).toEqual([{ metric: 'lcp', value: 3400, route: undefined, confidence: 0.55 }])
  })

  it('reads several metrics on one line', () => {
    expect(detect('LCP 2.1 s, CLS 0.05, TTFB 300 ms').map((h) => [h.metric, h.value])).toEqual([
      ['lcp', 2100],
      ['cls', 0.05],
      ['ttfb', 300],
    ])
  })

  it('attaches the route from the same line or the line above', () => {
    const hits = detect(
      'Page: https://shop.example/checkout\nLCP 3.4 s\n\n/home\nLCP 1.9 s\nCLS 0.02 on /cart',
    )
    expect(hits.map((h) => h.route)).toEqual(['https://shop.example/checkout', '/home', '/cart'])
  })

  it('reads a pipe table with a header row', () => {
    const text =
      '| Page | LCP | CLS | Requests |\n|---|---|---|---|\n| /checkout | 3400 | 0.12 | 210 |\n| /home | 1900 | 0.02 | 80 |'
    expect(detect(text)).toEqual([
      { metric: 'lcp', value: 3400, route: '/checkout', confidence: 0.9 },
      { metric: 'cls', value: 0.12, route: '/checkout', confidence: 0.9 },
      { metric: 'requests', value: 210, route: '/checkout', confidence: 0.9 },
      { metric: 'lcp', value: 1900, route: '/home', confidence: 0.9 },
      { metric: 'cls', value: 0.02, route: '/home', confidence: 0.9 },
      { metric: 'requests', value: 80, route: '/home', confidence: 0.9 },
    ])
  })

  it('ignores dates and impossible values', () => {
    expect(detect('Performance score report 2026-11-18')).toEqual([])
    expect(detect('Score 2026')).toEqual([])
    expect(detect('CLS 12')).toEqual([
      { metric: 'cls', value: 0.12, route: undefined, confidence: 0.85 },
    ])
  })

  it('is deterministic', () => {
    const text = 'LCP 3.4 s\nCLS 0.12\n| Page | TTFB |\n| /a | 400 |'
    expect(detect(text)).toEqual(detect(text))
  })
})

describe('metricForLabel', () => {
  it('tells exact names from fuzzy ones', () => {
    expect(metricForLabel('LCP (ms)')).toEqual({ metric: 'lcp', exact: true })
    expect(metricForLabel('largest contentful paint')).toEqual({ metric: 'lcp', exact: true })
    expect(metricForLabel('mobile LCP p75')).toEqual({ metric: 'lcp', exact: false })
    expect(metricForLabel('Page')).toBeUndefined()
    expect(metricForLabel('3.4 s')).toBeUndefined()
  })
})

describe('looksLikeReportLink', () => {
  it('accepts report and share links, rejects everything else', () => {
    expect(looksLikeReportLink('https://perf.example/reports/abc123')).toBe(true)
    expect(looksLikeReportLink(' http://localhost:4100/share/x_1 ')).toBe(true)
    expect(looksLikeReportLink('https://perf.example/app#report=abc')).toBe(true)
    expect(looksLikeReportLink('https://example.com/')).toBe(false)
    expect(looksLikeReportLink('LCP 3.4 s https://example.com/reports/1')).toBe(false)
    expect(looksLikeReportLink('javascript:alert(1)')).toBe(false)
  })
})
