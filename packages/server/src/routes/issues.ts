import { PerfAgentError, countChips, matchesChip, summarise, type Area, type ChipFilter, type IssueStatus, type MetricId } from '@perfagent/core'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

export function parseChip(raw: string | null): ChipFilter {
  if (!raw || raw === 'all') return { kind: 'all' }
  const [kind, id] = raw.split(':')
  if (kind === 'metric' && id) return { kind: 'metric', id: id as MetricId }
  if (kind === 'area' && id) return { kind: 'area', id: id as Area }
  return { kind: 'all' }
}

export function issueRoutes(router: Router, ctx: AppContext): void {
  const reportFor = async (id: string | null) => (id && id !== 'latest' ? ctx.store.get(id) : ctx.store.latest())

  router.get('/api/issues', async ({ query }) => {
    const report = await reportFor(query.get('reportId'))
    if (!report) return { issues: [], chips: countChips([]), reportId: undefined }
    const filter = parseChip(query.get('filter'))
    const route = query.get('route')
    const issues = report.issues.filter((i) => matchesChip(i, filter) && (!route || !i.route || i.route === route))
    return { reportId: report.id, issues, chips: countChips(report.issues) }
  })

  router.get('/api/issues/:id', async ({ params, query }) => {
    const report = await reportFor(query.get('reportId'))
    const issue = report?.issues.find((i) => i.id === params.id)
    if (!issue) throw new PerfAgentError('NOT_FOUND', 'Problem not found')
    return issue
  })

  router.post('/api/issues/:id/status', async ({ params, query, json }) => {
    const { status } = await json<{ status: IssueStatus }>()
    if (!['open', 'fixed', 'ignored'].includes(status)) throw new PerfAgentError('IMPORT_INVALID', 'Status must be open, fixed or ignored')
    const report = await reportFor(query.get('reportId'))
    if (!report) throw new PerfAgentError('NOT_FOUND', 'No report')
    return ctx.store.setIssueStatus(report.id, params.id ?? '', status)
  })

  router.get('/api/tree', async ({ query }) => {
    const report = await reportFor(query.get('reportId'))
    if (!report?.tree) throw new PerfAgentError('NOT_FOUND', 'No project tree in this report', 'Scan a local project to see its files.')
    return report.tree
  })

  router.get('/api/summary', async ({ query }) => {
    const report = await reportFor(query.get('reportId'))
    if (!report) throw new PerfAgentError('NOT_FOUND', 'No scans yet')
    return summarise(report, query.get('route') ?? undefined)
  })
}
