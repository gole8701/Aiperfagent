import { formatMetric, metricValue, projectedScore } from '@perfagent/core'

import { axisStyle, baseOption, sum } from './helpers'
import type { ChartDefinition } from './types'

const NEEDS_ANALYTICS =
  'Business impact needs your analytics (GA4, PostHog, Plausible…). Shows sample data until connected.'

const sellLess: ChartDefinition = {
  id: 'sell-less',
  kind: 'echarts',
  question: 'Do slower pages sell less?',
  howToRead: 'Conversion rate by how long the main content took to appear.',
  guide: 'score',
  height: 220,
  sample: () => NEEDS_ANALYTICS,
  build: (ctx) => {
    const p = ctx.palette
    return {
      ...baseOption(p),
      xAxis: {
        type: 'category',
        data: ['< 1 s', '1–2 s', '2–3 s', '3–4 s', '> 4 s'],
        ...axisStyle(p),
      },
      yAxis: {
        type: 'value',
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: '{value}%' },
      },
      series: [
        {
          type: 'bar',
          data: [3.8, 3.1, 2.4, 1.6, 0.9].map((v, i) => ({
            value: v,
            itemStyle: { color: i < 2 ? p.good : i < 3 ? p.warning : p.critical },
          })),
          label: { show: true, formatter: '{c}%', color: p.text },
          barMaxWidth: 40,
        },
      ],
    }
  },
  takeaway: () =>
    'Sample: visitors who wait over 4 seconds buy 4× less often than those who wait under 1 second.',
}

const leave: ChartDefinition = {
  id: 'leave',
  kind: 'echarts',
  question: 'How many leave without doing anything?',
  howToRead: 'Bounce rate over the last weeks, with your scans marked.',
  guide: 'score',
  height: 220,
  sample: () => NEEDS_ANALYTICS,
  build: (ctx) => {
    const p = ctx.palette
    return {
      ...baseOption(p),
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.panel,
        borderColor: p.border,
        textStyle: { color: p.text },
      },
      xAxis: {
        type: 'category',
        data: ['W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'now'],
        ...axisStyle(p),
      },
      yAxis: {
        type: 'value',
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: '{value}%' },
      },
      series: [
        {
          type: 'line',
          data: [41, 43, 48, 52, 51, 49],
          smooth: true,
          lineStyle: { color: p.critical },
          itemStyle: { color: p.critical },
          areaStyle: { opacity: 0.1 },
        },
      ],
    }
  },
  takeaway: () => 'Sample: bounces rose 11 points in the weeks when the page got slower.',
}

const costPerVisit: ChartDefinition = {
  id: 'cost-per-visit',
  kind: 'tiles',
  question: 'What does each visit cost, and what will fixes save?',
  howToRead:
    'Data, carbon, bandwidth and AI per visit today vs after the listed fixes (estimates).',
  guide: 'bundle',
  sample: () =>
    'Bandwidth and AI prices use typical rates until your analytics and billing are connected.',
  build: (ctx) => {
    const metrics = ctx.page?.metrics ?? []
    const kb = metricValue(metrics, 'transferKb') ?? 0
    const open = ctx.report.issues.filter((i) => i.status === 'open')
    const savingsKb =
      sum(open.filter((i) => i.gain.metric === 'jsKb').map((i) => i.gain.from - i.gain.to)) +
      kb *
        Math.min(
          0.4,
          open.filter((i) => i.areas.includes('images') || i.areas.includes('bundle')).length *
            0.08,
        )
    const afterKb = Math.max(0, kb - savingsKb)
    const co2 = (k: number): string => `${(k * 0.00035).toFixed(2)} g`
    const money = (k: number): string =>
      `$${((k / 1_048_576) * 0.08 * 10_000).toFixed(2)} / 10k visits`
    const aiCost = ctx.report.ai?.calls.length
      ? sum(ctx.report.ai.calls.map((c) => c.costUsd)) / ctx.report.ai.calls.length
      : 0
    const score = metricValue(metrics, 'score') ?? 0
    return [
      {
        label: 'Data per visit',
        value: `${formatMetric('transferKb', kb)} → ${formatMetric('transferKb', afterKb)}`,
        note: 'estimate after fixes',
        rating: afterKb < kb ? 'good' : undefined,
      },
      {
        label: 'CO₂ per visit',
        value: `${co2(kb)} → ${co2(afterKb)}`,
        note: 'estimate, 0.35 g per MB',
        rating: afterKb < kb ? 'good' : undefined,
      },
      {
        label: 'Bandwidth',
        value: `${money(kb)} → ${money(afterKb)}`,
        note: 'estimate at $0.08 per GB',
      },
      {
        label: 'AI per call · score',
        value: `${aiCost ? formatMetric('aiCostUsd', aiCost) : '—'} · ${score} → ${projectedScore(score, open)}`,
        note: aiCost ? 'measured AI cost per call' : 'no AI calls measured',
      },
    ]
  },
  takeaway: (ctx) => {
    const open = ctx.report.issues.filter((i) => i.status === 'open')
    return open.length
      ? `Applying the ${open.length} listed fixes trims data, carbon and bandwidth on every visit; the numbers are estimates until analytics are connected.`
      : 'Nothing left to trim.'
  },
}

export const business: ChartDefinition[] = [sellLess, leave, costPerVisit]
