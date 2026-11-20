import { METRICS, formatMetric } from './metrics.js'
import type { ChainStep, MetricId, RequestInfo, SourceLocation } from './types.js'

/**
 * Builds the "evidence" chain shown in the deep dive:
 * Metric → Element / Request → Component → Code.
 * Rules call this with whatever signals they have; missing links are skipped.
 */
export interface ChainInput {
  metric: MetricId
  value: number
  element?: string
  request?: RequestInfo
  component?: { name: string; location?: SourceLocation; renders?: number }
  code?: { snippet: string; location: SourceLocation }
  server?: { part: string; ms: number }
  dependency?: { name: string; sizeKb: number }
  cost?: { label: string; detail: string }
}

export function buildRootCauseChain(input: ChainInput): ChainStep[] {
  const steps: ChainStep[] = [
    {
      kind: 'metric',
      label: `${METRICS[input.metric].short} ${formatMetric(input.metric, input.value)}`,
      detail: METRICS[input.metric].plain,
    },
  ]
  if (input.element) steps.push({ kind: 'element', label: input.element })
  if (input.request) {
    const r = input.request
    steps.push({
      kind: 'request',
      label: fileName(r.url),
      detail: `${formatMetric('transferKb', r.transferBytes / 1024)}, starts at ${formatMetric('lcp', r.startMs)}${r.thirdParty ? ', third party' : ''}`,
    })
  }
  if (input.server)
    steps.push({ kind: 'server', label: input.server.part, detail: `${input.server.ms} ms` })
  if (input.dependency) {
    steps.push({
      kind: 'dependency',
      label: input.dependency.name,
      detail: `${input.dependency.sizeKb} KB`,
    })
  }
  if (input.component) {
    const c = input.component
    steps.push({
      kind: 'component',
      label: `<${c.name}>`,
      detail: c.renders ? `${c.renders} renders` : undefined,
      location: c.location,
    })
  }
  if (input.cost) steps.push({ kind: 'cost', label: input.cost.label, detail: input.cost.detail })
  if (input.code) {
    steps.push({
      kind: 'code',
      label: `${input.code.location.file}:${input.code.location.line}`,
      detail: input.code.snippet.trim(),
      location: input.code.location,
    })
  }
  return steps
}

function fileName(url: string): string {
  try {
    const path = new URL(url).pathname
    return path.split('/').filter(Boolean).pop() ?? url
  } catch {
    return url
  }
}
