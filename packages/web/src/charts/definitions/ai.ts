import { formatMetric, percentile, type AiCallSample, type AiReport } from '@perfagent/core'

import { axisStyle, baseOption, gauge, num, round, sum, type FormatterParams } from './helpers'
import type { ChartContext, ChartDefinition } from './types'

const NEEDS_AI = 'Needs measured AI calls: wrap your client with watchAI() or send OpenTelemetry GenAI spans. Shows sample data until connected.'

function sampleCalls(): AiCallSample[] {
  const out: AiCallSample[] = []
  for (let day = 0; day < 7; day++) {
    for (let i = 0; i < 6; i++) {
      const large = i % 3 === 0
      out.push({
        at: new Date(Date.now() - (6 - day) * 86_400_000 + i * 3_600_000).toISOString(),
        model: large ? 'large-model' : 'small-model',
        provider: 'sample',
        firstTokenMs: large ? 2200 + i * 80 : 850 + i * 40,
        totalMs: large ? 7800 : 3100,
        inputTokens: 14_200,
        outputTokens: 670,
        cachedTokens: i % 3 === 1 ? 9000 : 0,
        costUsd: large ? 0.42 + (day === 4 ? 0.9 : 0) : 0.06,
        retries: day === 3 && i < 3 ? 2 : 0,
        stalls: 0,
        error: day === 3 && i === 1 ? 'rate_limit' : undefined,
        steps: [
          { kind: 'rag', name: 'search docs', ms: 1800 },
          { kind: 'llm', name: 'answer', ms: 1200 },
          { kind: 'tool', name: 'format', ms: 400 },
        ],
      })
    }
  }
  return out
}

function ai(ctx: ChartContext): { report: AiReport; sample: boolean } {
  const real = ctx.report.ai
  if (real && real.calls.length) return { report: real, sample: false }
  const calls = sampleCalls()
  return { report: { calls, callSites: real?.callSites ?? [], models: summariseModels(calls), budgetUsdPerDay: real?.budgetUsdPerDay ?? 4 }, sample: true }
}

function summariseModels(calls: AiCallSample[]): AiReport['models'] {
  const byModel = new Map<string, AiCallSample[]>()
  for (const c of calls) byModel.set(c.model, [...(byModel.get(c.model) ?? []), c])
  return [...byModel.entries()].map(([model, list]) => ({
    model,
    calls: list.length,
    p50FirstTokenMs: percentile(list.map((c) => c.firstTokenMs), 50),
    p95FirstTokenMs: percentile(list.map((c) => c.firstTokenMs), 95),
    costUsd: sum(list.map((c) => c.costUsd)),
    errorRate: list.filter((c) => c.error).length / list.length,
  }))
}

const sampleNote = (ctx: ChartContext): string | undefined => (ai(ctx).sample ? NEEDS_AI : undefined)

const tiles: ChartDefinition = {
  id: 'ai-tiles',
  kind: 'tiles',
  question: 'AI at a glance',
  howToRead: 'First word, cost today, cache reuse and failures.',
  guide: 'measure-ai',
  sample: sampleNote,
  build: (ctx) => {
    const { report } = ai(ctx)
    const calls = report.calls
    const today = new Date().toDateString()
    const costToday = sum(calls.filter((c) => new Date(c.at).toDateString() === today).map((c) => c.costUsd))
    const cache = sum(calls.map((c) => c.cachedTokens)) / Math.max(1, sum(calls.map((c) => c.inputTokens)))
    const failures = calls.filter((c) => c.error).length / Math.max(1, calls.length)
    const first = percentile(calls.map((c) => c.firstTokenMs), 95)
    return [
      { label: 'First word (p95)', value: formatMetric('aiFirstTokenMs', first), note: 'time until the answer starts', rating: first <= 1000 ? 'good' : first <= 3000 ? 'needs-work' : 'poor' },
      { label: 'Cost today', value: formatMetric('aiCostUsd', costToday), note: report.budgetUsdPerDay ? `budget ${formatMetric('aiCostUsd', report.budgetUsdPerDay)}` : 'no budget set', rating: report.budgetUsdPerDay && costToday > report.budgetUsdPerDay ? 'poor' : 'good' },
      { label: 'Cache reuse', value: formatMetric('aiCacheHitRate', cache), note: 'of prompt tokens served from cache', rating: cache >= 0.7 ? 'good' : cache >= 0.3 ? 'needs-work' : 'poor' },
      { label: 'Failures', value: formatMetric('aiErrorRate', failures), note: 'calls that failed or were rate limited', rating: failures <= 0.01 ? 'good' : failures <= 0.05 ? 'needs-work' : 'poor' },
    ]
  },
  takeaway: (ctx) => (ai(ctx).sample ? 'Sample numbers: connect your AI calls to see your own.' : `${ai(ctx).report.calls.length} AI calls measured.`),
}

const wait: ChartDefinition = {
  id: 'ai-wait',
  kind: 'echarts',
  question: 'How long do users wait for an AI answer?',
  howToRead: 'Light bar = first word appears. Dark bar = answer finished. One pair per model.',
  guide: 'ai-first-token',
  height: 220,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const { report } = ai(ctx)
    const models = report.models
    const total = (model: string): number => percentile(report.calls.filter((c) => c.model === model).map((c) => c.totalMs), 50)
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => `${(v / 1000).toFixed(1)} s` } },
      yAxis: { type: 'category', data: models.map((m) => m.model), ...axisStyle(p) },
      series: [
        { name: 'first word', type: 'bar', data: models.map((m) => round(m.p50FirstTokenMs)), itemStyle: { color: p.series[3] ?? p.accent, opacity: 0.6 } },
        { name: 'answer done', type: 'bar', data: models.map((m) => round(total(m.model))), itemStyle: { color: p.series[3] ?? p.accent } },
      ],
    }
  },
  takeaway: (ctx) => {
    const models = [...ai(ctx).report.models].sort((a, b) => a.p50FirstTokenMs - b.p50FirstTokenMs)
    const fast = models[0]
    const slow = models[models.length - 1]
    return fast && slow && fast !== slow ? `${fast.model} starts answering ${(slow.p50FirstTokenMs / Math.max(1, fast.p50FirstTokenMs)).toFixed(1)}× faster than ${slow.model}. Use the slow one only for hard questions.` : `First word after ${formatMetric('aiFirstTokenMs', fast?.p50FirstTokenMs ?? 0)} (median).`
  },
}

const tokens: ChartDefinition = {
  id: 'ai-tokens',
  kind: 'echarts',
  question: 'What do you pay for in one AI request?',
  howToRead: 'Where the tokens (pieces of text) of a typical request go.',
  guide: 'ai-cost',
  height: 160,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const calls = ai(ctx).report.calls
    const n = Math.max(1, calls.length)
    const cached = sum(calls.map((c) => c.cachedTokens)) / n
    const input = sum(calls.map((c) => c.inputTokens)) / n - cached
    const output = sum(calls.map((c) => c.outputTokens)) / n
    return {
      ...baseOption(p),
      legend: { bottom: 0, textStyle: { color: p.text } },
      xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted } },
      yAxis: { type: 'category', data: ['typical request'], ...axisStyle(p) },
      series: [
        { name: 'repeated instructions (cached)', type: 'bar', stack: 't', data: [round(cached)], itemStyle: { color: p.good } },
        { name: 'instructions + question', type: 'bar', stack: 't', data: [round(input)], itemStyle: { color: p.warning } },
        { name: 'answer', type: 'bar', stack: 't', data: [round(output)], itemStyle: { color: p.accent } },
      ],
    }
  },
  takeaway: (ctx) => {
    const calls = ai(ctx).report.calls
    const input = sum(calls.map((c) => c.inputTokens))
    const cached = sum(calls.map((c) => c.cachedTokens))
    const share = input ? Math.round(((input - cached) / input) * 100) : 0
    return share > 60 ? `${share}% of the cost is the same instructions sent every time. Prompt caching makes it cheaper and faster.` : 'Most of the prompt is already served from cache.'
  },
  onClick: () => ({ filter: 'metric:aiCostUsd' }),
}

const costPerDay: ChartDefinition = {
  id: 'ai-cost-per-day',
  kind: 'echarts',
  question: 'How much does AI cost per day?',
  howToRead: 'Last 7 days. Dashed red line = your daily budget.',
  guide: 'ai-cost',
  height: 220,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const { report } = ai(ctx)
    const byDay = new Map<string, number>()
    for (const c of report.calls) {
      const day = new Date(c.at).toLocaleDateString(undefined, { weekday: 'short' })
      byDay.set(day, (byDay.get(day) ?? 0) + c.costUsd)
    }
    return {
      ...baseOption(p),
      xAxis: { type: 'category', data: [...byDay.keys()], ...axisStyle(p) },
      yAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: '${value}' } },
      series: [{ type: 'line', data: [...byDay.values()].map((v) => round(v, 2)), lineStyle: { color: p.accent }, itemStyle: { color: p.accent }, areaStyle: { opacity: 0.1 }, markLine: report.budgetUsdPerDay ? { symbol: 'none', data: [{ yAxis: report.budgetUsdPerDay, label: { formatter: 'budget', color: p.critical }, lineStyle: { color: p.critical, type: 'dashed' } }] } : undefined }],
    }
  },
  takeaway: (ctx) => {
    const { report } = ai(ctx)
    const budget = report.budgetUsdPerDay
    const byDay = new Map<string, number>()
    for (const c of report.calls) byDay.set(new Date(c.at).toDateString(), (byDay.get(new Date(c.at).toDateString()) ?? 0) + c.costUsd)
    const over = budget ? [...byDay.values()].filter((v) => v > budget).length : 0
    return budget ? (over ? `${over} day${over > 1 ? 's' : ''} went over the ${formatMetric('aiCostUsd', budget)} budget.` : 'Every day stayed inside the budget.') : 'Set ai.budgetUsdPerDay in the config to see a budget line.'
  },
}

const steps: ChartDefinition = {
  id: 'ai-steps',
  kind: 'echarts',
  question: 'Where does the AI spend its time?',
  howToRead: 'One answer, step by step: searches, model calls and tools, left to right.',
  guide: 'measure-ai',
  height: 200,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const call = ai(ctx).report.calls.find((c) => c.steps?.length)
    const list = call?.steps ?? []
    let cursor = 0
    const kindColour = { llm: p.series[3] ?? p.accent, tool: p.accent, rag: p.warning }
    const rows = list.map((s) => {
      const start = cursor
      cursor += s.ms
      return { name: `${s.name} (${s.kind})`, start, ms: s.ms, colour: kindColour[s.kind] }
    })
    return {
      ...baseOption(p),
      grid: { left: 12, right: 60, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => `${(v / 1000).toFixed(1)} s` } },
      yAxis: { type: 'category', data: rows.map((r) => r.name), inverse: true, ...axisStyle(p) },
      series: [
        { type: 'bar', stack: 'g', data: rows.map((r) => r.start), itemStyle: { color: 'transparent' }, silent: true, barWidth: 16 },
        { type: 'bar', stack: 'g', barWidth: 16, data: rows.map((r) => ({ value: r.ms, itemStyle: { color: r.colour } })), label: { show: true, position: 'right', color: p.text, formatter: (d: FormatterParams) => `${(num(d.value) / 1000).toFixed(1)} s` } },
      ],
    }
  },
  takeaway: (ctx) => {
    const call = ai(ctx).report.calls.find((c) => c.steps?.length)
    const list = call?.steps ?? []
    const total = sum(list.map((s) => s.ms))
    const biggest = [...list].sort((a, b) => b.ms - a.ms)[0]
    return biggest ? `${biggest.name} takes ${Math.round((biggest.ms / total) * 100)}% of the time${biggest.kind !== 'llm' ? ', not the AI itself' : ''}.` : 'No agent steps recorded.'
  },
  onClick: () => ({ filter: 'metric:aiFirstTokenMs' }),
}

const cache: ChartDefinition = {
  id: 'ai-cache',
  kind: 'echarts',
  question: 'How often is AI work reused?',
  howToRead: 'Share of repeated instructions served from cache. Higher = cheaper and faster.',
  guide: 'ai-cost',
  height: 240,
  sample: sampleNote,
  build: (ctx) => {
    const calls = ai(ctx).report.calls
    const share = Math.round((sum(calls.map((c) => c.cachedTokens)) / Math.max(1, sum(calls.map((c) => c.inputTokens)))) * 100)
    return gauge(ctx, share, { unit: '%', target: 70, label: 'from cache' })
  },
  takeaway: (ctx) => {
    const calls = ai(ctx).report.calls
    const share = Math.round((sum(calls.map((c) => c.cachedTokens)) / Math.max(1, sum(calls.map((c) => c.inputTokens)))) * 100)
    return share < 70 ? `Only ${share}% is reused: most repeated instructions are paid for again every time.` : `${share}% reused: prompt caching is working.`
  },
}

const failures: ChartDefinition = {
  id: 'ai-failures',
  kind: 'echarts',
  question: 'How often does the AI fail or get blocked?',
  howToRead: 'Failed or rate-limited requests per day.',
  guide: 'measure-ai',
  height: 200,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const byDay = new Map<string, number>()
    for (const c of ai(ctx).report.calls) {
      const day = new Date(c.at).toLocaleDateString(undefined, { weekday: 'short' })
      byDay.set(day, (byDay.get(day) ?? 0) + (c.error ? 1 : 0) + c.retries)
    }
    return {
      ...baseOption(p),
      xAxis: { type: 'category', data: [...byDay.keys()], ...axisStyle(p) },
      yAxis: { type: 'value', ...axisStyle(p), minInterval: 1 },
      series: [{ type: 'bar', data: [...byDay.values()], itemStyle: { color: p.critical }, barMaxWidth: 30, label: { show: true, color: p.text } }],
    }
  },
  takeaway: (ctx) => {
    const calls = ai(ctx).report.calls
    const retries = sum(calls.map((c) => c.retries))
    return retries ? `${retries} retries happened: failed requests were retried instantly. Waiting a little between retries fixes most of it.` : 'No failures or rate limits recorded.'
  },
}

const bestDeal: ChartDefinition = {
  id: 'ai-best-deal',
  kind: 'echarts',
  question: 'Which AI option is the best deal?',
  howToRead: 'Further right = faster. Higher = cheaper per call. Bigger bubble = more calls.',
  guide: 'ai-cost',
  height: 260,
  sample: sampleNote,
  build: (ctx) => {
    const p = ctx.palette
    const models = ai(ctx).report.models
    const maxCost = Math.max(...models.map((m) => m.costUsd / Math.max(1, m.calls)), 0.01)
    return {
      ...baseOption(p),
      grid: { left: 12, right: 24, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'value', name: 'faster →', inverse: true, ...axisStyle(p), axisLabel: { color: p.muted, formatter: (v: number) => `${(v / 1000).toFixed(1)} s` } },
      yAxis: { type: 'value', name: 'cheaper ↑', max: 100, ...axisStyle(p), axisLabel: { color: p.muted, formatter: '{value}' } },
      series: [{ type: 'scatter', data: models.map((m, i) => ({ name: m.model, value: [round(m.p50FirstTokenMs), round(100 - ((m.costUsd / Math.max(1, m.calls)) / maxCost) * 100)], symbolSize: 20 + Math.min(40, m.calls), itemStyle: { color: p.series[i % p.series.length] }, label: { show: true, formatter: '{b}', position: 'top', color: p.text } })) }],
    }
  },
  takeaway: (ctx) => {
    const models = ai(ctx).report.models
    const cheapest = [...models].sort((a, b) => a.costUsd / Math.max(1, a.calls) - b.costUsd / Math.max(1, b.calls))[0]
    return cheapest && models.length > 1 ? `${cheapest.model} is the cheapest per call and still fast. Send simple questions to it.` : 'Measure more than one model to compare them.'
  },
}

export const aiCharts: ChartDefinition[] = [tiles, wait, tokens, costPerDay, steps, cache, failures, bestDeal]
