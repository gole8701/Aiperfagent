import { formatMetric, metricValue } from '@perfagent/core'

import { axisStyle, baseOption, gauge, horizontalBars } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const NEEDS_RUM = 'Needs real-user data (agent script) or CrUX. Shows sample data until connected.'

function hasField(ctx: ChartContext): boolean {
  return Boolean(ctx.page?.metrics.some((m) => m.p75 !== undefined))
}

const distribution: ChartDefinition = {
  id: 'lcp-distribution',
  kind: 'echarts',
  question: 'How fast is it for most visitors?',
  howToRead: 'Share of real visits by how long the main content took to appear.',
  guide: 'lcp',
  height: 220,
  sample: (ctx) => (hasField(ctx) ? undefined : NEEDS_RUM),
  build: (ctx) => {
    const p = ctx.palette
    const lcp = metricValue(ctx.page?.metrics ?? [], 'lcp') ?? 2500
    const centre = Math.min(5, Math.max(0, Math.round(lcp / 1000)))
    const buckets = ['< 1 s', '1–2 s', '2–3 s', '3–4 s', '4–6 s', '> 6 s']
    const values = buckets.map((_, i) => Math.max(2, Math.round(40 * Math.exp(-((i - centre) ** 2) / 2))))
    const total = values.reduce((a, b) => a + b, 0)
    return {
      ...baseOption(p),
      xAxis: { type: 'category', data: buckets, ...axisStyle(p) },
      yAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: '{value}%' } },
      series: [{ type: 'bar', barCategoryGap: '8%', data: values.map((v, i) => ({ value: Math.round((v / total) * 100), itemStyle: { color: i < 3 ? p.good : i < 4 ? p.warning : p.critical } })), label: { show: true, formatter: '{c}%', color: p.text } }],
    }
  },
  takeaway: (ctx) => {
    const lcp = metricValue(ctx.page?.metrics ?? [], 'lcp') ?? 0
    return `${hasField(ctx) ? 'Real visitors' : 'Sample shaped around your lab result'}: the main content typically appears after ${formatMetric('lcp', lcp)}. Visits over 3 s are the group to win back.`
  },
}

const countries: ChartDefinition = {
  id: 'countries',
  kind: 'echarts',
  question: 'Which countries wait the longest?',
  howToRead: 'Time until the main content shows, by visitor country.',
  guide: 'locations',
  height: 240,
  sample: () => 'Needs real-user data with countries, or tests from other locations. Shows sample data until connected.',
  build: (ctx) => horizontalBars(ctx, ['India', 'Germany', 'United Kingdom', 'United States'], [2.1, 2.6, 2.9, 4.3], { unit: ' s', colors: [ctx.palette.good, ctx.palette.warning, ctx.palette.warning, ctx.palette.critical] }),
  takeaway: () => 'Sample: visitors far from the server wait longest. A CDN or an edge region would help them.',
}

const connection: ChartDefinition = {
  id: 'connection',
  kind: 'echarts',
  question: 'Does the internet connection matter?',
  howToRead: 'Time until the main content shows, by connection type.',
  guide: 'lcp',
  height: 220,
  sample: () => NEEDS_RUM,
  build: (ctx) => {
    const lcp = (metricValue(ctx.page?.metrics ?? [], 'lcp') ?? 3000) / 1000
    return horizontalBars(ctx, ['Wi-Fi / cable', '4G', '3G'], [Math.round(lcp * 0.6 * 10) / 10, Math.round(lcp * 10) / 10, Math.round(lcp * 2.1 * 10) / 10], { unit: ' s', colors: [ctx.palette.good, ctx.palette.warning, ctx.palette.critical] })
  },
  takeaway: (ctx) => `Sample scaled from your lab result: on slow 3G the page takes about ${Math.round(((metricValue(ctx.page?.metrics ?? [], 'lcp') ?? 3000) / 1000) * 2.1)} seconds. Smaller images and less JavaScript help most there.`,
}

const agents: ChartDefinition = {
  id: 'agent-readiness',
  kind: 'echarts',
  question: 'Can AI assistants use your site?',
  howToRead: 'Agent readiness 0–100: labels, names, structured data and an llms.txt file.',
  guide: 'agent-readiness',
  height: 240,
  build: (ctx) => gauge(ctx, ctx.report.readiness?.score ?? metricValue(ctx.page?.metrics ?? [], 'agentReadiness') ?? 0, { target: 80, label: 'agent readiness' }),
  takeaway: (ctx) => {
    const r = ctx.report.readiness
    if (!r) return 'Agent readiness was not measured in this scan.'
    const notes = r.notes.length ? ` ${r.notes.join('. ')}.` : ''
    return r.score >= 80 ? `AI agents can use your site well (${r.score}).${notes}` : `AI agents will struggle (${r.score}): ${r.missingLabels} missing labels, ${r.interactiveWithoutName} controls without a name.${notes}`
  },
  onClick: () => ({ filter: 'metric:agentReadiness' }),
}

export const users: ChartDefinition[] = [distribution, countries, connection, agents]
