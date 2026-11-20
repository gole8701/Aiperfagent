import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Report } from '@perfagent/core'
import { describe, expect, it } from 'vitest'

import { CHARTS, CHART_TABS, type ChartContext } from './index'

const sample = JSON.parse(
  readFileSync(
    path.resolve(__dirname, '../../../../../fixtures/reports/demo-shop-before.json'),
    'utf8',
  ),
) as Report

const ctx: ChartContext = {
  report: sample,
  page: sample.pages[0],
  history: [{ reportId: sample.id, at: sample.createdAt, score: 53 }],
  expert: false,
  palette: {
    text: '#fff',
    muted: '#aaa',
    border: '#333',
    panel: '#111',
    good: '#1b8',
    warning: '#fb3',
    critical: '#f64',
    accent: '#4af',
    series: ['#4af', '#fb3', '#1b8', '#b9f', '#f64', '#7dc', '#fc7', '#8a9'],
  },
}

describe('chart catalogue', () => {
  it('has 8 tabs and 35 charts', () => {
    expect(CHART_TABS).toHaveLength(8)
    expect(Object.values(CHARTS).flat()).toHaveLength(35)
  })

  for (const tab of CHART_TABS) {
    for (const chart of CHARTS[tab.id]) {
      it(`${tab.id}/${chart.id} builds from the sample report`, () => {
        expect(chart.question.endsWith('?') || chart.kind !== 'echarts').toBe(true)
        expect(chart.takeaway(ctx).length).toBeGreaterThan(10)
        if (chart.kind === 'echarts') {
          const option = chart.build(ctx)
          expect(option.series).toBeTruthy()
          expect(JSON.stringify(option)).not.toContain('NaN')
        } else if (chart.kind === 'tiles') {
          expect(chart.build(ctx).length).toBeGreaterThan(0)
        } else if (chart.kind === 'summary') {
          expect(chart.build(ctx).headline.length).toBeGreaterThan(0)
        } else {
          expect(chart.build(ctx).frames).toBeInstanceOf(Array)
        }
      })
    }
  }

  it('expert mode still builds every chart', () => {
    for (const chart of Object.values(CHARTS).flat())
      expect(() => chart.build({ ...ctx, expert: true })).not.toThrow()
  })
})
