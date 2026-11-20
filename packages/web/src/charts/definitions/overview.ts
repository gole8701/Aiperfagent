import {
  AREAS,
  CORE_WEB_VITALS,
  METRICS,
  describePhases,
  formatMetric,
  metricValue,
  projectedScore,
  rateMetric,
  summarise,
  type Issue,
  type MetricId,
} from '@perfagent/core'

import { axisStyle, baseOption, donut, horizontalBars, round, seconds } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const PHASE_LABEL = {
  server: 'Waiting for the server',
  download: 'Downloading files',
  script: 'Running scripts',
  render: 'Drawing the page',
}

function openIssues(ctx: ChartContext): Issue[] {
  return ctx.report.issues
    .filter((i) => i.status === 'open' && (!ctx.route || !i.route || i.route === ctx.route))
    .sort((a, b) => b.gain.scoreDelta - a.gain.scoreDelta)
}

const inSimpleWords: ChartDefinition = {
  id: 'in-simple-words',
  kind: 'summary',
  question: 'In simple words: what is wrong and what do I do first?',
  howToRead: 'Generated from your scan, no AI needed.',
  guide: 'charts',
  build: (ctx) => {
    const s = summarise(ctx.report, ctx.route)
    return { headline: s.headline, sentences: s.sentences }
  },
  takeaway: (ctx) => {
    const s = summarise(ctx.report, ctx.route)
    return s.topIssues.length
      ? `Fixing everything listed takes the score from ${s.scoreNow} to about ${s.scoreAfterFixes}.`
      : 'Nothing to fix right now.'
  },
}

const slowsMost: ChartDefinition = {
  id: 'what-slows-most',
  kind: 'echarts',
  question: 'What slows your page the most?',
  howToRead:
    'Longer bar = more score points you win by fixing it. Click a bar to see it on the globe.',
  guide: 'deep-dive',
  height: 360,
  build: (ctx) => {
    const issues = openIssues(ctx).slice(0, 10)
    const p = ctx.palette
    return horizontalBars(
      ctx,
      issues.map((i) => (ctx.expert ? i.title : i.plain)),
      issues.map((i) => i.gain.scoreDelta),
      {
        colors: issues.map((i) =>
          i.severity === 'critical' ? p.critical : i.severity === 'warning' ? p.warning : p.accent,
        ),
        unit: ' pts',
      },
    )
  },
  takeaway: (ctx) => {
    const first = openIssues(ctx)[0]
    return first
      ? `Biggest win: ${first.plain.toLowerCase()} (about +${first.gain.scoreDelta} points).`
      : 'No open problems.'
  },
  onClick: (params, ctx) => {
    const issue = openIssues(ctx)[params.dataIndex ?? -1]
    return issue ? { issueId: issue.id } : undefined
  },
}

const whereSecondsGo: ChartDefinition = {
  id: 'where-seconds-go',
  kind: 'echarts',
  question: 'Where do the seconds go?',
  howToRead: 'Time before the main content appears, split into what the browser was doing.',
  guide: 'lcp',
  height: 160,
  build: (ctx) => {
    const phases = ctx.page?.phases ?? []
    const p = ctx.palette
    return {
      ...baseOption(p),
      grid: { left: 12, right: 16, top: 8, bottom: 8, containLabel: true },
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: {
        type: 'value',
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: (v: number) => seconds(v) },
      },
      yAxis: { type: 'category', data: [ctx.page?.route ?? 'page'], ...axisStyle(p) },
      series: phases.map((phase, i) => ({
        name: PHASE_LABEL[phase.phase],
        type: 'bar',
        stack: 'time',
        data: [round(phase.ms)],
        itemStyle: { color: p.series[i % p.series.length] },
        label: { show: phase.ms > 300, formatter: () => seconds(phase.ms), color: p.text },
      })),
    }
  },
  takeaway: (ctx) => describePhases(ctx.page?.phases ?? []) || 'No timing phases in this report.',
}

const whatKind: ChartDefinition = {
  id: 'what-kind',
  kind: 'echarts',
  question: 'What kind of problems?',
  howToRead: 'Problems grouped by type. Click a slice to filter the globe.',
  guide: 'chips',
  height: 320,
  build: (ctx) => {
    const groups = new Map<string, number>()
    for (const issue of openIssues(ctx)) {
      const group = AREAS.find((a) => a.id === issue.areas[0])?.group ?? 'Other'
      groups.set(group, (groups.get(group) ?? 0) + 1)
    }
    const data = [...groups.entries()].map(([name, value]) => ({ name, value }))
    return donut(ctx, data, String(openIssues(ctx).length))
  },
  takeaway: (ctx) => {
    const groups = new Map<string, number>()
    for (const issue of openIssues(ctx)) {
      const group = AREAS.find((a) => a.id === issue.areas[0])?.group ?? 'Other'
      groups.set(group, (groups.get(group) ?? 0) + 1)
    }
    const top = [...groups.entries()].sort((a, b) => b[1] - a[1])[0]
    return top
      ? `Most problems are about ${top[0].toLowerCase()} (${top[1]}).`
      : 'No open problems.'
  },
  onClick: (params, ctx) => {
    const area = AREAS.find(
      (a) => a.group === params.name && openIssues(ctx).some((i) => i.areas[0] === a.id),
    )
    return area ? { filter: `area:${area.id}` } : undefined
  },
}

const vsTarget: ChartDefinition = {
  id: 'vs-target',
  kind: 'echarts',
  question: 'How fast is it compared with the target?',
  howToRead:
    'Green zone = good, amber = needs work, red = poor. The white marker is your page today.',
  guide: 'score',
  height: 300,
  build: (ctx) => {
    const p = ctx.palette
    const metrics = CORE_WEB_VITALS.filter(
      (id) => metricValue(ctx.page?.metrics ?? [], id) !== undefined,
    )
    const rows = metrics.map((id) => {
      const m = METRICS[id]
      const value = metricValue(ctx.page?.metrics ?? [], id) ?? 0
      const max = Math.max((m.poor ?? 1) * 1.6, value * 1.15)
      return { id, value, good: m.good ?? 0, poor: m.poor ?? 0, max }
    })
    const label = (id: MetricId): string =>
      ctx.expert ? METRICS[id].short : `${METRICS[id].plain} (${METRICS[id].short})`
    return {
      ...baseOption(p),
      grid: { left: 12, right: 80, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', max: 1, show: false },
      yAxis: {
        type: 'category',
        data: rows.map((r) => label(r.id)),
        inverse: true,
        ...axisStyle(p),
        axisLabel: { color: p.text, width: 260, overflow: 'break' },
      },
      series: [
        {
          type: 'bar',
          stack: 'zone',
          barWidth: 18,
          data: rows.map((r) => r.good / r.max),
          itemStyle: { color: p.good, opacity: 0.35 },
          silent: true,
        },
        {
          type: 'bar',
          stack: 'zone',
          barWidth: 18,
          data: rows.map((r) => (r.poor - r.good) / r.max),
          itemStyle: { color: p.warning, opacity: 0.35 },
          silent: true,
        },
        {
          type: 'bar',
          stack: 'zone',
          barWidth: 18,
          data: rows.map((r) => (r.max - r.poor) / r.max),
          itemStyle: { color: p.critical, opacity: 0.35 },
          silent: true,
        },
        {
          type: 'scatter',
          symbol: 'rect',
          symbolSize: [4, 26],
          data: rows.map((r) => ({
            value: [Math.min(1, r.value / r.max), label(r.id)],
            itemStyle: { color: p.text },
          })),
          label: {
            show: true,
            position: 'right',
            color: p.text,
            formatter: (d: { dataIndex: number }) =>
              `${formatMetric(rows[d.dataIndex]?.id ?? 'lcp', rows[d.dataIndex]?.value ?? 0)} · aim ≤ ${formatMetric(rows[d.dataIndex]?.id ?? 'lcp', rows[d.dataIndex]?.good ?? 0)}`,
          },
        },
      ],
    }
  },
  takeaway: (ctx) => {
    const poor = CORE_WEB_VITALS.filter((id) => {
      const v = metricValue(ctx.page?.metrics ?? [], id)
      return v !== undefined && rateMetric(id, v) === 'poor'
    })
    return poor.length
      ? `Out of the green: ${poor.map((id) => METRICS[id].short).join(', ')}. Start there.`
      : 'Every Core Web Vital is close to or inside the green zone.'
  },
}

const trend: ChartDefinition = {
  id: 'trend',
  kind: 'echarts',
  question: 'Is it getting better or worse?',
  howToRead:
    'Score over your saved scans. Dashed green = target 90. Last point = estimate after fixes.',
  guide: 'score',
  height: 260,
  build: (ctx) => {
    const p = ctx.palette
    const points = ctx.history.length
      ? ctx.history
      : [
          {
            reportId: ctx.report.id,
            at: ctx.report.createdAt,
            score: metricValue(ctx.page?.metrics ?? [], 'score') ?? 0,
          },
        ]
    const projected = projectedScore(points[points.length - 1]?.score ?? 0, openIssues(ctx))
    const labels = [...points.map((h) => new Date(h.at).toLocaleDateString()), 'after fixes']
    return {
      ...baseOption(p),
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.panel,
        borderColor: p.border,
        textStyle: { color: p.text },
      },
      xAxis: { type: 'category', data: labels, ...axisStyle(p) },
      yAxis: { type: 'value', min: 0, max: 100, ...axisStyle(p) },
      series: [
        {
          type: 'line',
          data: [...points.map((h) => h.score), null],
          smooth: true,
          lineStyle: { color: p.accent, width: 3 },
          itemStyle: { color: p.accent },
          markLine: {
            symbol: 'none',
            data: [
              {
                yAxis: 90,
                label: { formatter: 'target 90', color: p.good },
                lineStyle: { color: p.good, type: 'dashed' },
              },
            ],
          },
          markPoint: {
            data: points
              .filter((h) => h.annotation)
              .map((h, i) => ({
                name: h.annotation ?? '',
                coord: [i, h.score],
                value: h.annotation,
                itemStyle: { color: p.warning },
                label: { color: p.text, fontSize: 10 },
              })),
          },
        },
        {
          type: 'line',
          data: [
            ...points.map(() => null).slice(0, -1),
            points[points.length - 1]?.score ?? 0,
            projected,
          ],
          lineStyle: { color: p.good, type: 'dotted' },
          itemStyle: { color: p.good },
        },
      ],
    }
  },
  takeaway: (ctx) => {
    const h = ctx.history
    if (h.length < 2) return 'One scan so far. Scan again after a change to see the trend.'
    const first = h[0]?.score ?? 0
    const last = h[h.length - 1]?.score ?? 0
    return last > first + 2
      ? `Up ${last - first} points since the first scan.`
      : last < first - 2
        ? `Down ${first - last} points since the first scan.`
        : 'Roughly flat across your scans.'
  },
}

export const overview: ChartDefinition[] = [
  inSimpleWords,
  slowsMost,
  whereSecondsGo,
  whatKind,
  vsTarget,
  trend,
]
