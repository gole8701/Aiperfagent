import { readFile } from 'node:fs/promises'

import { percentile, type AiCallSample, type AiReport, type SourceLocation } from '@perfagent/core'

const MAX_SAMPLES = 20_000

export interface AiReportOptions {
  budgetUsdPerDay?: number
  callSites?: SourceLocation[]
}

/** Reads `ai-samples.jsonl` (written by watchAI / the proxy / the browser agent) into the dashboard's AiReport. */
export async function buildAiReport(
  samplesFile: string,
  options: AiReportOptions = {},
): Promise<AiReport> {
  const text = await readFile(samplesFile, 'utf8').catch(() => '')
  const lines = text.split('\n').filter(Boolean).slice(-MAX_SAMPLES)
  const calls: AiCallSample[] = []
  for (const line of lines) {
    try {
      const sample = JSON.parse(line) as Partial<AiCallSample>
      if (typeof sample.model === 'string' && typeof sample.totalMs === 'number')
        calls.push(normalise(sample))
    } catch {
      // A half-written line at the end of the file is expected; skip it.
    }
  }
  return {
    calls,
    callSites: options.callSites ?? [],
    models: aggregate(calls),
    budgetUsdPerDay: options.budgetUsdPerDay,
  }
}

function normalise(s: Partial<AiCallSample>): AiCallSample {
  return {
    at: s.at ?? new Date(0).toISOString(),
    route: s.route,
    model: s.model ?? 'unknown',
    provider: s.provider ?? 'unknown',
    firstTokenMs: s.firstTokenMs ?? s.totalMs ?? 0,
    totalMs: s.totalMs ?? 0,
    inputTokens: s.inputTokens ?? 0,
    outputTokens: s.outputTokens ?? 0,
    cachedTokens: s.cachedTokens ?? 0,
    costUsd: s.costUsd ?? 0,
    error: s.error,
    retries: s.retries ?? 0,
    stalls: s.stalls ?? 0,
    steps: s.steps,
  }
}

export function aggregate(calls: AiCallSample[]): AiReport['models'] {
  const groups = new Map<string, AiCallSample[]>()
  for (const call of calls) groups.set(call.model, [...(groups.get(call.model) ?? []), call])
  return [...groups.entries()]
    .map(([model, samples]) => {
      const ttft = samples.filter((s) => !s.error).map((s) => s.firstTokenMs)
      return {
        model,
        calls: samples.length,
        p50FirstTokenMs: Math.round(percentile(ttft, 50)),
        p95FirstTokenMs: Math.round(percentile(ttft, 95)),
        costUsd: Math.round(samples.reduce((sum, s) => sum + s.costUsd, 0) * 1_000_000) / 1_000_000,
        errorRate:
          Math.round((samples.filter((s) => s.error).length / samples.length) * 1000) / 1000,
      }
    })
    .sort((a, b) => b.calls - a.calls)
}
