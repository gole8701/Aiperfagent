import { matchesChip, type Area, type Issue, type MetricId, type Report } from '@perfagent/core'
import type { FixScope } from '@perfagent/engine'

/** Open issues the scope covers, biggest estimated gain first. */
export function selectIssues(report: Report, scope: FixScope): Issue[] {
  const open = report.issues.filter((i) => i.status === 'open')
  let picked: Issue[]
  switch (scope.kind) {
    case 'issue':
      picked = open.filter((i) => scope.issueIds.includes(i.id))
      break
    case 'file':
      picked = open.filter((i) => i.location?.file === scope.file)
      break
    case 'chip': {
      const [kind, id] = scope.chip.split(':')
      picked = kind === 'metric' && id ? open.filter((i) => matchesChip(i, { kind: 'metric', id: id as MetricId })) : kind === 'area' && id ? open.filter((i) => matchesChip(i, { kind: 'area', id: id as Area })) : []
      break
    }
    case 'route':
      picked = open.filter((i) => i.route === scope.route || (!i.route && report.pages.length === 1))
      break
    case 'site':
      picked = open
      break
  }
  return [...picked].sort((a, b) => b.gain.scoreDelta - a.gain.scoreDelta)
}
