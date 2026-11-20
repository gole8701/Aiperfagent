import { formatMetric, metricValue, type RequestInfo } from '@perfagent/core'

import { axisStyle, baseOption, fileName, round, seconds } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const filmstrip: ChartDefinition = {
  id: 'filmstrip',
  kind: 'filmstrip',
  question: 'What does your visitor see, second by second?',
  howToRead: 'Snapshots of the screen while the page loads.',
  guide: 'lcp',
  build: (ctx) => ({ frames: ctx.page?.filmstrip ?? [] }),
  takeaway: (ctx) => {
    const frames = ctx.page?.filmstrip ?? []
    const fcp = metricValue(ctx.page?.metrics ?? [], 'fcp')
    const lcp = metricValue(ctx.page?.metrics ?? [], 'lcp')
    if (!frames.length) return 'No screenshots were captured in this scan.'
    return `Visitors see a blank screen for about ${fcp !== undefined ? formatMetric('fcp', fcp) : '?'}; the main content appears at ${lcp !== undefined ? formatMetric('lcp', lcp) : '?'}. Most people decide to stay or leave in the first 3 seconds.`
  },
}

const TYPE_LABEL: Record<RequestInfo['type'], string> = {
  document: 'Page',
  script: 'Script',
  stylesheet: 'Styles',
  image: 'Image',
  font: 'Font',
  fetch: 'Data',
  websocket: 'WebSocket',
  other: 'Other',
}

function topRequests(ctx: ChartContext): RequestInfo[] {
  return [...(ctx.page?.requests ?? [])]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 12)
    .sort((a, b) => a.startMs - b.startMs)
}

const waterfall: ChartDefinition = {
  id: 'waterfall',
  kind: 'echarts',
  question: 'What loads when?',
  howToRead:
    'Each bar shows when a file starts and finishes loading. The 12 longest downloads are shown.',
  guide: 'bundle',
  height: 360,
  build: (ctx) => {
    const p = ctx.palette
    const rows = topRequests(ctx)
    const typeColour: Record<string, string> = {
      image: p.series[1] ?? p.accent,
      script: p.series[3] ?? p.accent,
      stylesheet: p.series[2] ?? p.accent,
      font: p.series[6] ?? p.accent,
      fetch: p.series[5] ?? p.accent,
      document: p.accent,
      websocket: p.series[4] ?? p.accent,
      other: p.muted,
    }
    return {
      ...baseOption(p),
      grid: { left: 12, right: 60, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: (v: number) => seconds(v) },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => (ctx.expert ? r.url : `${fileName(r.url)} (${TYPE_LABEL[r.type]})`)),
        inverse: true,
        ...axisStyle(p),
        axisLabel: { color: p.text, width: 220, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          stack: 'wf',
          data: rows.map((r) => round(r.startMs)),
          itemStyle: { color: 'transparent' },
          silent: true,
          barWidth: 14,
        },
        {
          type: 'bar',
          stack: 'wf',
          barWidth: 14,
          data: rows.map((r) => ({
            value: Math.max(20, round(r.durationMs)),
            itemStyle: { color: typeColour[r.type] ?? p.accent },
          })),
          label: {
            show: true,
            position: 'right',
            color: p.muted,
            formatter: (d: { dataIndex: number }) =>
              `${seconds(rows[d.dataIndex]?.durationMs ?? 0)} · ${formatMetric('transferKb', (rows[d.dataIndex]?.transferBytes ?? 0) / 1024)}`,
          },
        },
      ],
    }
  },
  takeaway: (ctx) => {
    const longest = [...(ctx.page?.requests ?? [])].sort((a, b) => b.durationMs - a.durationMs)[0]
    return longest
      ? `${fileName(longest.url)} takes the longest (${seconds(longest.durationMs)}, starts at ${seconds(longest.startMs)}). Starting it earlier or making it smaller is the biggest speed win.`
      : 'No request timings in this report.'
  },
}

const goodExperience: ChartDefinition = {
  id: 'good-experience',
  kind: 'echarts',
  question: 'How many real visitors had a good experience?',
  howToRead:
    'Share of visits with good (green), so-so (amber) and bad (red) loading speed, by device.',
  guide: 'lcp',
  height: 200,
  sample: (ctx) =>
    ctx.page?.metrics.some((m) => m.p75 !== undefined)
      ? undefined
      : 'Real-user data needs the live agent script or CrUX. Shows sample data until connected.',
  build: (ctx) => {
    const p = ctx.palette
    const real = ctx.page?.metrics.find((m) => m.id === 'lcp' && m.p75 !== undefined)
    const rows = real
      ? [
          {
            label: ctx.page?.device ?? 'mobile',
            good: (real.p75 ?? 0) <= 2500 ? 75 : 40,
            mid: 15,
            bad: (real.p75 ?? 0) <= 2500 ? 10 : 45,
          },
        ]
      : [
          { label: 'Phone', good: 52, mid: 23, bad: 25 },
          { label: 'Computer', good: 88, mid: 9, bad: 3 },
        ]
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: {
        type: 'value',
        max: 100,
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: '{value}%' },
      },
      yAxis: { type: 'category', data: rows.map((r) => r.label), ...axisStyle(p) },
      series: [
        {
          name: 'Good',
          type: 'bar',
          stack: 'x',
          data: rows.map((r) => r.good),
          itemStyle: { color: p.good },
          label: { show: true, formatter: '{c}% good', color: p.text },
        },
        {
          name: 'So-so',
          type: 'bar',
          stack: 'x',
          data: rows.map((r) => r.mid),
          itemStyle: { color: p.warning },
        },
        {
          name: 'Bad',
          type: 'bar',
          stack: 'x',
          data: rows.map((r) => r.bad),
          itemStyle: { color: p.critical },
        },
      ],
    }
  },
  takeaway: (ctx) =>
    ctx.page?.metrics.some((m) => m.p75 !== undefined)
      ? 'Based on your real visitors (75th percentile).'
      : 'Sample: only half of phone visitors get a good experience while computers are fine. Fix for phones first.',
}

export const speed: ChartDefinition[] = [filmstrip, waterfall, goodExperience]
