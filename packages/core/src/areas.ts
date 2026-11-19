import type { Area, Issue, MetricId } from './types.js'

export interface AreaDefinition {
  id: Area
  label: string
  plain: string
  group: 'Server & network' | 'JavaScript' | 'Images & fonts' | 'Styles' | 'Memory' | 'AI' | 'Other'
}

export const AREAS: AreaDefinition[] = [
  { id: 'javascript', label: 'JavaScript', plain: 'Scripts doing too much work', group: 'JavaScript' },
  { id: 'bundle', label: 'Bundle', plain: 'Too much code downloaded', group: 'JavaScript' },
  { id: 'code-splitting', label: 'Code splitting', plain: 'Code not split per page', group: 'JavaScript' },
  { id: 'unused-code', label: 'Unused code', plain: 'Downloaded code never used', group: 'JavaScript' },
  { id: 'hydration', label: 'Hydration', plain: 'Slow start of the app in the browser', group: 'JavaScript' },
  { id: 're-renders', label: 'Re-renders', plain: 'Parts of the screen redrawn too often', group: 'JavaScript' },
  { id: 'images', label: 'Images', plain: 'Pictures that are big or load late', group: 'Images & fonts' },
  { id: 'fonts', label: 'Fonts', plain: 'Text that jumps or loads late', group: 'Images & fonts' },
  { id: 'css', label: 'CSS', plain: 'Styles that block or are unused', group: 'Styles' },
  { id: 'rendering', label: 'Rendering', plain: 'Layout jumps and slow drawing', group: 'Styles' },
  { id: 'third-party', label: 'Third-party', plain: 'Other companies’ scripts', group: 'Server & network' },
  { id: 'caching', label: 'Caching', plain: 'Things downloaded again on every visit', group: 'Server & network' },
  { id: 'api', label: 'API', plain: 'Slow or uncached data requests', group: 'Server & network' },
  { id: 'network', label: 'Network', plain: 'Too many or too slow downloads', group: 'Server & network' },
  { id: 'server', label: 'Server', plain: 'The server answers slowly', group: 'Server & network' },
  { id: 'websocket', label: 'WebSocket', plain: 'Unstable live connection', group: 'Server & network' },
  { id: 'memory', label: 'Memory', plain: 'The app gets heavier the longer it is open', group: 'Memory' },
  { id: 'ai', label: 'AI', plain: 'Slow or costly AI calls', group: 'AI' },
  { id: 'agents', label: 'Agents', plain: 'Hard for AI assistants to use', group: 'AI' },
  { id: 'security', label: 'Security', plain: 'A key or secret exposed', group: 'Other' },
  { id: 'accessibility', label: 'Accessibility', plain: 'Missing labels and names', group: 'Other' },
]

export const CHIP_METRICS: MetricId[] = ['lcp', 'inp', 'cls', 'ttfb', 'tbt', 'fcp', 'aiFirstTokenMs', 'aiCostUsd', 'agentReadiness']

export interface ChipCounts {
  metrics: Partial<Record<MetricId, number>>
  areas: Partial<Record<Area, number>>
  total: number
}

export function countChips(issues: Issue[]): ChipCounts {
  const counts: ChipCounts = { metrics: {}, areas: {}, total: 0 }
  for (const issue of issues) {
    if (issue.status !== 'open') continue
    counts.total++
    for (const m of issue.metrics) counts.metrics[m] = (counts.metrics[m] ?? 0) + 1
    for (const a of issue.areas) counts.areas[a] = (counts.areas[a] ?? 0) + 1
  }
  return counts
}

export type ChipFilter = { kind: 'all' } | { kind: 'metric'; id: MetricId } | { kind: 'area'; id: Area }

export function matchesChip(issue: Issue, filter: ChipFilter): boolean {
  if (filter.kind === 'all') return true
  if (filter.kind === 'metric') return issue.metrics.includes(filter.id)
  return issue.areas.includes(filter.id)
}
