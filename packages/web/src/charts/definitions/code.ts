import { formatMetric, type Issue } from '@perfagent/core'

import {
  axisStyle,
  baseOption,
  fileName,
  horizontalBars,
  hostOf,
  num,
  percent,
  round,
  sum,
  type FormatterParams,
} from './helpers'
import type { ChartContext, ChartDefinition } from './types'

function scripts(ctx: ChartContext) {
  return (ctx.page?.requests ?? []).filter((r) => r.type === 'script' || r.type === 'stylesheet')
}

const treemap: ChartDefinition = {
  id: 'code-treemap',
  kind: 'echarts',
  question: 'What takes up space in your code?',
  howToRead: 'Bigger box = more to download. Grouped by where the file comes from.',
  guide: 'bundle',
  height: 360,
  build: (ctx) => {
    const p = ctx.palette
    const byHost = new Map<string, { name: string; value: number }[]>()
    for (const r of scripts(ctx)) {
      const host = hostOf(r.url)
      byHost.set(host, [
        ...(byHost.get(host) ?? []),
        { name: ctx.expert ? r.url : fileName(r.url), value: round(r.transferBytes / 1024, 1) },
      ])
    }
    const pageHost = hostOf(ctx.page?.url ?? '')
    const data = [...byHost.entries()].map(([host, children], i) => ({
      name: host === pageHost ? `${host} (your site)` : host,
      children,
      itemStyle: { color: p.series[i % p.series.length] },
    }))
    return {
      ...baseOption(p),
      tooltip: {
        formatter: (d: FormatterParams | FormatterParams[]) =>
          (Array.isArray(d) ? d : [d])
            .map((x) => `${x.name ?? ''}: ${num(x.value)} KB`)
            .join('<br>'),
        backgroundColor: p.panel,
        borderColor: p.border,
        textStyle: { color: p.text },
      },
      series: [
        {
          type: 'treemap',
          data,
          roam: false,
          breadcrumb: { show: false },
          label: {
            color: p.text,
            formatter: (d: FormatterParams) => `${d.name ?? ''}\n${num(d.value)} KB`,
          },
          upperLabel: { show: true, color: p.text, height: 22 },
          itemStyle: { borderColor: p.panel, gapWidth: 2 },
        },
      ],
    }
  },
  takeaway: (ctx) => {
    const list = scripts(ctx)
    const total = sum(list.map((r) => r.transferBytes))
    const biggest = [...list].sort((a, b) => b.transferBytes - a.transferBytes)[0]
    return biggest
      ? `${fileName(biggest.url)} alone is ${percent(biggest.transferBytes, total)}% of the ${formatMetric('transferKb', total / 1024)} of code downloaded.`
      : 'No scripts or styles recorded.'
  },
}

const unused: ChartDefinition = {
  id: 'unused-code',
  kind: 'echarts',
  question: 'How much downloaded code is never used?',
  howToRead: 'Blue = used on this page, red = downloaded but not used.',
  guide: 'bundle',
  height: 320,
  build: (ctx) => {
    const p = ctx.palette
    const rows = [...(ctx.page?.coverage ?? [])]
      .sort((a, b) => b.unusedBytes - a.unusedBytes)
      .slice(0, 8)
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      grid: { left: 12, right: 60, top: 8, bottom: 30, containLabel: true },
      xAxis: {
        type: 'value',
        ...axisStyle(p),
        axisLabel: { color: p.muted, formatter: (v: number) => `${Math.round(v)} KB` },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => (ctx.expert ? r.url : fileName(r.url))),
        inverse: true,
        ...axisStyle(p),
        axisLabel: { color: p.text, width: 200, overflow: 'truncate' },
      },
      series: [
        {
          name: 'Used',
          type: 'bar',
          stack: 'c',
          data: rows.map((r) => round((r.totalBytes - r.unusedBytes) / 1024)),
          itemStyle: { color: p.accent },
        },
        {
          name: 'Not used',
          type: 'bar',
          stack: 'c',
          data: rows.map((r) => round(r.unusedBytes / 1024)),
          itemStyle: { color: p.critical },
          label: {
            show: true,
            position: 'right',
            color: p.text,
            formatter: (d: { dataIndex: number }) =>
              `${percent(rows[d.dataIndex]?.unusedBytes ?? 0, rows[d.dataIndex]?.totalBytes ?? 1)}% unused`,
          },
        },
      ],
    }
  },
  takeaway: (ctx) => {
    const rows = ctx.page?.coverage ?? []
    if (!rows.length) return 'No coverage data: scan with the installed tool to see unused code.'
    const total = sum(rows.map((r) => r.totalBytes))
    const wasted = sum(rows.map((r) => r.unusedBytes))
    return `${percent(wasted, total)}% of the downloaded code (${formatMetric('transferKb', wasted / 1024)}) is never used on this page.`
  },
}

function renderIssues(ctx: ChartContext): { issue: Issue; renders: number }[] {
  return ctx.report.issues
    .filter(
      (i) =>
        i.status === 'open' &&
        (i.areas.includes('re-renders') || i.chain.some((s) => /render/i.test(s.detail ?? ''))),
    )
    .map((issue) => {
      const match = issue.chain.map((s) => /(\d+)\s*renders?/i.exec(s.detail ?? '')).find(Boolean)
      return { issue, renders: match ? Number(match[1]) : 0 }
    })
}

const redraws: ChartDefinition = {
  id: 'redraws',
  kind: 'echarts',
  question: 'Which parts of the screen redraw the most?',
  howToRead: 'Number of redraws during one visit. Fewer is better.',
  guide: 'inp',
  height: 240,
  sample: (ctx) =>
    renderIssues(ctx).length
      ? undefined
      : 'Re-render counts come from the React profiler during a local scan. Shows sample data until one is found.',
  build: (ctx) => {
    const rows = renderIssues(ctx)
    const labels = rows.length
      ? rows.map((r) => r.issue.location?.symbol ?? r.issue.plain)
      : ['CartSummary', 'ProductGrid', 'Header', 'Footer']
    const values = rows.length
      ? rows.map((r) => r.renders || r.issue.gain.scoreDelta)
      : [42, 12, 3, 1]
    return horizontalBars(ctx, labels, values, {
      unit: ' redraws',
      colors: values.map((v) =>
        v > 20 ? ctx.palette.critical : v > 10 ? ctx.palette.warning : ctx.palette.accent,
      ),
    })
  },
  takeaway: (ctx) => {
    const top = renderIssues(ctx).sort((a, b) => b.renders - a.renders)[0]
    return top
      ? `${top.issue.location?.symbol ?? 'One component'} redraws ${top.renders || 'too many'} times: ${top.issue.plain.toLowerCase()}.`
      : 'Sample: the cart redraws 42 times while someone types an address. That is why typing feels slow.'
  },
  onClick: (params, ctx) => {
    const row = renderIssues(ctx)[params.dataIndex ?? -1]
    return row ? { issueId: row.issue.id } : undefined
  },
}

export const code: ChartDefinition[] = [treemap, unused, redraws]
