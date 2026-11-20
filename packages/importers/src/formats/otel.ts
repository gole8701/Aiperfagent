import { median, percentile, type AiCallSample, type AiReport, type PageResult } from '@perfagent/core'

import { emptyReport, pageFromMetrics } from '../report-builder.js'
import type { Importer } from '../types.js'

import { readClaudeCodeMetrics } from './otel-metrics.js'
import { normaliseSpans, type Span } from './otel-spans.js'

/** USD per 1M tokens (input, output) for well-known models. Prices change; unknown models cost 0 and get a warning. */
const PRICES: [string, number, number][] = [
  ['claude-opus-5-5', 4, 20], ['claude-opus-5', 5, 25], ['claude-opus-4', 5, 25],
  ['claude-sonnet-5-5', 2, 10], ['claude-sonnet-5', 2, 10], ['claude-sonnet-4', 3, 15],
  ['claude-haiku-5-5', 0.1, 0.5], ['claude-haiku-4', 1, 5], ['claude-3-5-haiku', 0.8, 4],
  ['gpt-4o-mini', 0.15, 0.6], ['gpt-4o', 2.5, 10], ['gpt-4.1-mini', 0.4, 1.6], ['gpt-4.1', 2, 8], ['gpt-5-mini', 0.25, 2], ['gpt-5', 1.25, 10],
  ['gemini-2.5-flash', 0.3, 2.5], ['gemini-2.5-pro', 1.25, 10],
]

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | undefined {
  const price = PRICES.find(([prefix]) => model.toLowerCase().startsWith(prefix))
  return price ? (inputTokens * price[1] + outputTokens * price[2]) / 1_000_000 : undefined
}

const isOtel = (json: unknown): boolean => {
  if (!json || typeof json !== 'object') return false
  if (Array.isArray(json)) return json.some((s) => typeof s === 'object' && s !== null && 'traceId' in s && 'name' in s)
  return 'resourceSpans' in json || 'resourceMetrics' in json
}

export const otelImporter: Importer = {
  format: 'otel',
  matches: (_input, json) => isOtel(json),
  run: (input, json) => {
    const spans = normaliseSpans(json)
    const warnings: string[] = []
    const calls = [...spans.filter(isGenAi).map((s) => callFromSpan(s, warnings)), ...readClaudeCodeMetrics(json)].slice(0, 20_000)
    const pages = pagesFromHttp(spans.filter(isHttpServer))
    const ai: AiReport | undefined = calls.length ? { calls, callSites: [], models: aggregateModels(calls) } : undefined
    if (ai && calls.some((c) => c.costUsd === 0 && !c.model.startsWith('claude-code'))) warnings.push('Some models have no price in the built-in table, so their cost shows as $0. Prices change; check your provider bill.')
    const at = calls[0]?.at ?? (spans[0] ? new Date(spans[0].startMs).toISOString() : undefined)
    const report = emptyReport(input.filename ?? 'OpenTelemetry', { createdAt: at ?? new Date().toISOString(), environment: { name: 'otel', device: 'desktop', browser: 'chromium', mode: 'imported' }, pages, ai })
    return Promise.resolve({ format: 'otel', report, detected: [], warnings: [...new Set(warnings)], exact: true })
  },
}

const isGenAi = (s: Span): boolean => 'gen_ai.request.model' in s.attrs || 'gen_ai.system' in s.attrs || 'gen_ai.operation.name' in s.attrs
const isHttpServer = (s: Span): boolean => s.kind === 'server' && (typeof routeOfSpan(s) === 'string')

function routeOfSpan(s: Span): string | undefined {
  const route = s.attrs['http.route'] ?? s.attrs['url.path'] ?? s.attrs['http.target']
  return typeof route === 'string' ? route.split('?')[0] : undefined
}

/** One page per route: the median server duration stands in for TTFB, p75 and sample count come along. */
function pagesFromHttp(spans: Span[]): PageResult[] {
  const byRoute = new Map<string, number[]>()
  for (const s of spans) {
    const route = routeOfSpan(s) ?? '/'
    byRoute.set(route, [...(byRoute.get(route) ?? []), s.durationMs])
  }
  return [...byRoute].slice(0, 200).map(([route, durations]) => {
    const page = pageFromMetrics(route, { ttfb: Math.round(median(durations)) }, 'desktop')
    const ttfb = page.metrics.find((m) => m.id === 'ttfb')
    if (ttfb) Object.assign(ttfb, { p75: Math.round(percentile(durations, 75)), sampleCount: durations.length, samples: durations.slice(0, 50) })
    return page
  })
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : 0
}

function callFromSpan(s: Span, warnings: string[]): AiCallSample {
  const a = s.attrs
  const model = String(a['gen_ai.response.model'] ?? a['gen_ai.request.model'] ?? 'unknown')
  const inputTokens = Math.round(num(a['gen_ai.usage.input_tokens'] ?? a['gen_ai.usage.prompt_tokens']))
  const outputTokens = Math.round(num(a['gen_ai.usage.output_tokens'] ?? a['gen_ai.usage.completion_tokens']))
  const firstTokenEvent = s.events.find((e) => /first[_ -]?token/i.test(e.name) || e.name === 'gen_ai.content.completion')
  const ttft = a['gen_ai.server.time_to_first_token'] !== undefined ? num(a['gen_ai.server.time_to_first_token']) * 1000 : firstTokenEvent ? firstTokenEvent.timeMs - s.startMs : s.durationMs
  const cost = estimateCostUsd(model, inputTokens, outputTokens)
  if (cost === undefined) warnings.push(`No price known for ${model}; its cost shows as $0.`)
  return {
    at: new Date(s.startMs).toISOString(),
    route: typeof a['http.route'] === 'string' ? a['http.route'] : undefined,
    model,
    provider: String(a['gen_ai.system'] ?? a['gen_ai.provider.name'] ?? 'unknown'),
    firstTokenMs: Math.max(0, Math.round(ttft)),
    totalMs: Math.round(s.durationMs),
    inputTokens,
    outputTokens,
    cachedTokens: Math.round(num(a['gen_ai.usage.cache_read_input_tokens'] ?? a['gen_ai.usage.cached_tokens'])),
    costUsd: cost ?? 0,
    error: s.error,
    retries: 0,
    stalls: 0,
  }
}

export function aggregateModels(calls: AiCallSample[]): AiReport['models'] {
  const byModel = new Map<string, AiCallSample[]>()
  for (const c of calls) byModel.set(c.model, [...(byModel.get(c.model) ?? []), c])
  return [...byModel].slice(0, 100).map(([model, list]) => {
    const ttft = list.map((c) => c.firstTokenMs)
    return {
      model,
      calls: list.length,
      p50FirstTokenMs: Math.round(median(ttft)),
      p95FirstTokenMs: Math.round(percentile(ttft, 95)),
      costUsd: Math.round(list.reduce((s, c) => s + c.costUsd, 0) * 1e6) / 1e6,
      errorRate: list.filter((c) => c.error).length / list.length,
    }
  })
}
