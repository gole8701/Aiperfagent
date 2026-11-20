import { formatMetric, type RequestInfo } from '@perfagent/core'

import { axisStyle, baseOption, donut, gauge, horizontalBars, hostOf, percent, round, sum } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const TYPE_LABEL: Record<RequestInfo['type'], string> = { document: 'Page', script: 'Scripts', stylesheet: 'Styles', image: 'Images', font: 'Fonts', fetch: 'Data requests', websocket: 'WebSocket', other: 'Other' }

function requests(ctx: ChartContext): RequestInfo[] {
  return ctx.page?.requests ?? []
}

const downloads: ChartDefinition = {
  id: 'downloads',
  kind: 'echarts',
  question: 'What does the page download?',
  howToRead: 'Files grouped by type.',
  guide: 'bundle',
  height: 320,
  build: (ctx) => {
    const counts = new Map<string, number>()
    for (const r of requests(ctx)) counts.set(TYPE_LABEL[r.type], (counts.get(TYPE_LABEL[r.type]) ?? 0) + 1)
    return donut(ctx, [...counts.entries()].map(([name, value]) => ({ name, value })), String(requests(ctx).length))
  },
  takeaway: (ctx) => {
    const images = requests(ctx).filter((r) => r.type === 'image').length
    const total = requests(ctx).length
    if (!total) return 'No requests recorded.'
    return images > 20 ? `${images} images is a lot for one page. Load the ones further down the page later.` : `${total} files in total; nothing unusual in the mix.`
  },
}

const origin: ChartDefinition = {
  id: 'data-origin',
  kind: 'echarts',
  question: 'Where does the downloaded data come from?',
  howToRead: 'Your site vs other companies’ services, in kilobytes.',
  guide: 'bundle',
  height: 160,
  build: (ctx) => {
    const p = ctx.palette
    const own = sum(requests(ctx).filter((r) => !r.thirdParty).map((r) => r.transferBytes)) / 1024
    const third = sum(requests(ctx).filter((r) => r.thirdParty).map((r) => r.transferBytes)) / 1024
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => formatMetric('transferKb', v) } },
      yAxis: { type: 'category', data: ['Downloaded'], ...axisStyle(p) },
      series: [
        { name: 'Your site', type: 'bar', stack: 'o', data: [round(own)], itemStyle: { color: p.accent }, label: { show: true, color: p.text, formatter: () => `${percent(own, own + third)}%` } },
        { name: 'Other companies', type: 'bar', stack: 'o', data: [round(third)], itemStyle: { color: p.warning }, label: { show: true, color: p.text, formatter: () => `${percent(third, own + third)}%` } },
      ],
    }
  },
  takeaway: (ctx) => {
    const all = requests(ctx)
    const third = sum(all.filter((r) => r.thirdParty).map((r) => r.transferBytes))
    const total = sum(all.map((r) => r.transferBytes))
    return total ? `${percent(third, total)}% of the data comes from other companies’ tools you do not control.` : 'No requests recorded.'
  },
}

function thirdParties(ctx: ChartContext): { host: string; ms: number; kb: number }[] {
  const byHost = new Map<string, { ms: number; kb: number }>()
  for (const r of requests(ctx).filter((r) => r.thirdParty && (r.type === 'script' || r.blocking))) {
    const host = hostOf(r.url)
    const cur = byHost.get(host) ?? { ms: 0, kb: 0 }
    byHost.set(host, { ms: cur.ms + r.durationMs, kb: cur.kb + r.transferBytes / 1024 })
  }
  return [...byHost.entries()].map(([host, v]) => ({ host, ...v })).sort((a, b) => b.ms - a.ms).slice(0, 8)
}

const outsideTools: ChartDefinition = {
  id: 'outside-tools',
  kind: 'echarts',
  question: 'Which outside tools slow your page?',
  howToRead: 'Time each third-party script keeps the page busy. Click one to see its problem.',
  guide: 'tbt',
  height: 260,
  build: (ctx) => {
    const rows = thirdParties(ctx)
    return horizontalBars(ctx, rows.map((r) => r.host), rows.map((r) => Math.round(r.ms)), { unit: ' ms', colors: rows.map((r) => (r.ms > 300 ? ctx.palette.critical : r.ms > 100 ? ctx.palette.warning : ctx.palette.accent)) })
  },
  takeaway: (ctx) => {
    const top = thirdParties(ctx)[0]
    return top ? `${top.host} alone takes ${formatMetric('tbt', top.ms)}. Load it after the page is ready.` : 'No third-party scripts found.'
  },
  onClick: (_params, ctx) => {
    const issue = ctx.report.issues.find((i) => i.status === 'open' && i.areas.includes('third-party'))
    return issue ? { issueId: issue.id } : { filter: 'area:third-party' }
  },
}

const reuse: ChartDefinition = {
  id: 'cache-reuse',
  kind: 'echarts',
  question: 'On a second visit, how much is reused?',
  howToRead: 'Share of files the browser can keep instead of downloading again. Higher is better.',
  guide: 'caching',
  height: 240,
  build: (ctx) => gauge(ctx, cachedShare(ctx), { unit: '%', target: 80, label: 'reused' }),
  takeaway: (ctx) => {
    const share = cachedShare(ctx)
    return share >= 80 ? 'Returning visitors reuse most files: repeat visits are fast.' : `Returning visitors re-download about ${100 - share}% of files. Better cache settings make repeat visits almost instant.`
  },
  onClick: () => ({ filter: 'area:caching' }),
}

function cachedShare(ctx: ChartContext): number {
  const all = requests(ctx)
  if (!all.length) return 0
  const cached = all.filter((r) => r.cached).length
  if (cached) return percent(cached, all.length)
  // Scans record cached flags only on repeat views; estimate from caching issues otherwise.
  const uncached = ctx.report.issues.filter((i) => i.status === 'open' && i.areas.includes('caching')).length
  return Math.max(10, 85 - uncached * 25)
}

export const network: ChartDefinition[] = [downloads, origin, outsideTools, reuse]
