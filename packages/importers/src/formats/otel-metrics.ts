import type { AiCallSample } from '@perfagent/core'

import { readAttributes } from './otel-spans.js'

/**
 * Claude Code telemetry (OTLP metrics JSON): `claude_code.token.usage` data
 * points carry `type` (input/output/cacheRead/cacheCreation) and `model`;
 * `claude_code.cost.usage` carries the dollars. One sample per model.
 */
interface DataPoint { attributes?: unknown; asInt?: string | number; asDouble?: number; timeUnixNano?: string | number }
interface Metric { name?: string; sum?: { dataPoints?: DataPoint[] }; gauge?: { dataPoints?: DataPoint[] } }
interface ResourceMetrics { resourceMetrics?: { scopeMetrics?: { metrics?: Metric[] }[] }[] }

interface Totals { input: number; output: number; cached: number; costUsd: number; at?: number }

export function readClaudeCodeMetrics(json: unknown): AiCallSample[] {
  const resources = (json as ResourceMetrics | null)?.resourceMetrics
  if (!Array.isArray(resources)) return []
  const byModel = new Map<string, Totals>()
  const totals = (model: string): Totals => {
    const t = byModel.get(model) ?? { input: 0, output: 0, cached: 0, costUsd: 0 }
    byModel.set(model, t)
    return t
  }
  for (const metric of resources.flatMap((r) => (r.scopeMetrics ?? []).flatMap((s) => s.metrics ?? []))) {
    if (metric.name !== 'claude_code.token.usage' && metric.name !== 'claude_code.cost.usage') continue
    for (const point of metric.sum?.dataPoints ?? metric.gauge?.dataPoints ?? []) {
      const attrs = readAttributes(point.attributes)
      const t = totals(String(attrs.model ?? 'claude-code'))
      const value = Number(point.asDouble ?? point.asInt ?? 0)
      const at = Number(point.timeUnixNano ?? 0) / 1e6
      if (at && (!t.at || at < t.at)) t.at = at
      if (metric.name === 'claude_code.cost.usage') t.costUsd += value
      else if (attrs.type === 'input') t.input += value
      else if (attrs.type === 'output') t.output += value
      else if (attrs.type === 'cacheRead') t.cached += value
    }
  }
  return [...byModel].map(([model, t]) => ({
    at: new Date(t.at ?? Date.now()).toISOString(),
    model,
    provider: 'claude-code',
    firstTokenMs: 0,
    totalMs: 0,
    inputTokens: Math.round(t.input),
    outputTokens: Math.round(t.output),
    cachedTokens: Math.round(t.cached),
    costUsd: Math.round(t.costUsd * 1e6) / 1e6,
    retries: 0,
    stalls: 0,
  }))
}
