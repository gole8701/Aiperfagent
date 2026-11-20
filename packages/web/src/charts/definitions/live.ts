import { formatMetric, type LiveStats } from '@perfagent/core'

import { axisStyle, baseOption, round } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const NEEDS_LIVE = 'Needs a Live session (browser or agent script). Shows sample data until one is recorded.'

const SAMPLE: LiveStats = {
  windowSeconds: 60,
  requestsPerSec: Array.from({ length: 60 }, (_, i) => (i === 32 ? 182 : 8 + Math.round(6 * Math.sin(i / 4)))),
  p95LatencyMs: Array.from({ length: 60 }, (_, i) => (i === 32 ? 2600 : 400 + Math.round(120 * Math.sin(i / 3)))),
  websocket: { messagesPerSec: Array.from({ length: 60 }, (_, i) => (i > 30 && i < 36 ? 146 : 20)), bytesPerSec: [], reconnects: [31, 32, 33, 34, 35, 36, 37].map((s) => ({ at: `${s}`, reason: 'connection closed' })), rttMs: [] },
  peaks: [{ at: '32', metric: 'requestsPerSec', value: 182 }],
  memoryMb: Array.from({ length: 60 }, (_, i) => 40 + i * 2),
}

function live(ctx: ChartContext): { stats: LiveStats; sample: boolean } {
  return ctx.report.live && ctx.report.live.requestsPerSec.length ? { stats: ctx.report.live, sample: false } : { stats: SAMPLE, sample: true }
}

function labels(stats: LiveStats): string[] {
  return stats.requestsPerSec.map((_, i) => `${i - stats.requestsPerSec.length + 1}s`)
}

function lineOption(ctx: ChartContext, x: string[], values: number[], colour: string, unit: string, marks?: { x: number; label: string }[]) {
  const p = ctx.palette
  return {
    ...baseOption(p),
    tooltip: { trigger: 'axis' as const, backgroundColor: p.panel, borderColor: p.border, textStyle: { color: p.text } },
    xAxis: { type: 'category' as const, data: x, ...axisStyle(p), axisLabel: { color: p.muted, interval: Math.max(0, Math.floor(x.length / 6)) } },
    yAxis: { type: 'value' as const, ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => `${v}${unit}` } },
    series: [
      {
        type: 'line' as const,
        data: values.map((v) => round(v, 1)),
        showSymbol: false,
        lineStyle: { color: colour, width: 2 },
        areaStyle: { color: colour, opacity: 0.12 },
        markLine: marks ? { symbol: 'none', data: marks.map((m) => ({ xAxis: m.x, label: { formatter: m.label, color: p.critical }, lineStyle: { color: p.critical } })) } : undefined,
      },
    ],
  }
}

const busy: ChartDefinition = {
  id: 'live-busy',
  kind: 'echarts',
  question: 'How busy is your site right now?',
  howToRead: 'Requests per second during the live session. Red line = peak.',
  guide: 'live',
  height: 220,
  sample: (ctx) => (live(ctx).sample ? NEEDS_LIVE : undefined),
  build: (ctx) => {
    const { stats } = live(ctx)
    const peakIndex = stats.requestsPerSec.indexOf(Math.max(...stats.requestsPerSec))
    return lineOption(ctx, labels(stats), stats.requestsPerSec, ctx.palette.accent, '/s', peakIndex >= 0 ? [{ x: peakIndex, label: `peak ${Math.round(stats.requestsPerSec[peakIndex] ?? 0)}/s` }] : undefined)
  },
  takeaway: (ctx) => {
    const { stats, sample } = live(ctx)
    const peak = Math.max(...stats.requestsPerSec)
    return sample ? 'Sample: a sudden peak happened when every open tab reconnected at once after a deploy.' : `Peak of ${Math.round(peak)} requests per second during the session.`
  },
}

const stable: ChartDefinition = {
  id: 'live-websocket',
  kind: 'echarts',
  question: 'Is the live connection stable?',
  howToRead: 'WebSocket messages per second. Red lines = the connection dropped and reconnected.',
  guide: 'live',
  height: 220,
  sample: (ctx) => (live(ctx).sample ? NEEDS_LIVE : undefined),
  build: (ctx) => {
    const { stats } = live(ctx)
    const x = labels(stats)
    const drops = stats.websocket.reconnects.slice(0, 12).map((r, i) => ({ x: Number.isFinite(Number(r.at)) ? Number(r.at) : Math.min(x.length - 1, i * 5), label: i === 0 ? 'reconnect' : '' }))
    return lineOption(ctx, x, stats.websocket.messagesPerSec.length ? stats.websocket.messagesPerSec : x.map(() => 0), ctx.palette.series[3] ?? ctx.palette.accent, '/s', drops)
  },
  takeaway: (ctx) => {
    const { stats } = live(ctx)
    const n = stats.websocket.reconnects.length
    return n > 3 ? `${n} reconnects in the session. Adding a short, growing wait between retries stops the storm.` : `${n} reconnect${n === 1 ? '' : 's'}: the live connection is stable.`
  },
  onClick: () => ({ filter: 'area:websocket' }),
}

const serverBusy: ChartDefinition = {
  id: 'server-busy',
  kind: 'echarts',
  question: 'What is your server busy with?',
  howToRead: 'Time per request split into database, cache and building the page (from Server-Timing headers).',
  guide: 'ttfb',
  height: 200,
  sample: () => 'Needs Server-Timing headers or OpenTelemetry from your backend. Shows sample data until connected.',
  build: (ctx) => {
    const p = ctx.palette
    const rows = ['/api/products', '/api/cart', '/']
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: '{value} ms' } },
      yAxis: { type: 'category', data: rows, ...axisStyle(p) },
      series: [
        { name: 'database', type: 'bar', stack: 's', data: [820, 120, 60], itemStyle: { color: p.critical } },
        { name: 'cache', type: 'bar', stack: 's', data: [20, 15, 10], itemStyle: { color: p.good } },
        { name: 'building the page', type: 'bar', stack: 's', data: [90, 40, 180], itemStyle: { color: p.accent } },
      ],
    }
  },
  takeaway: () => 'Sample: the product request spends 0.8 s in the database because of a missing index and no caching.',
}

const heavier: ChartDefinition = {
  id: 'memory-over-time',
  kind: 'echarts',
  question: 'Does the app get heavier the longer it is open?',
  howToRead: 'Memory used over the session. A line that keeps rising means something is never cleaned up.',
  guide: 'memory',
  height: 220,
  sample: (ctx) => (live(ctx).sample ? NEEDS_LIVE : undefined),
  build: (ctx) => {
    const { stats } = live(ctx)
    return lineOption(ctx, labels(stats), stats.memoryMb, ctx.palette.warning, ' MB')
  },
  takeaway: (ctx) => {
    const { stats } = live(ctx)
    const first = stats.memoryMb[0] ?? 0
    const last = stats.memoryMb[stats.memoryMb.length - 1] ?? 0
    return last > first * 1.5 ? `Memory grew from ${formatMetric('memoryMb', first)} to ${formatMetric('memoryMb', last)}. A timer or listener is probably never stopped; after long use the tab gets slow.` : 'Memory stays flat: nothing leaks over time.'
  },
  onClick: () => ({ filter: 'area:memory' }),
}

export const liveCharts: ChartDefinition[] = [busy, stable, serverBusy, heavier]
