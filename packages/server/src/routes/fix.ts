import { PerfAgentError } from '@perfagent/core'
import type { FixRunRequest } from '@perfagent/engine'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

/** AI fix loop. Local mode only; the fixer writes to a new git branch and never pushes. */
export function fixRoutes(router: Router, ctx: AppContext): void {
  const fix = (): NonNullable<AppContext['fix']> => {
    if (!ctx.fix) throw new PerfAgentError('NOT_LOCAL_MODE', 'Fixing is only available in the installed tool on a git project')
    return ctx.fix
  }

  router.post('/api/fix/runs', async ({ json }) => {
    const body = await json<FixRunRequest>()
    if (!body.reportId || !body.scope) throw new PerfAgentError('IMPORT_INVALID', 'reportId and scope are required')
    const run = await fix().start(body, (event) => ctx.hub.broadcast({ type: 'fix:event', runId: run.id, event }))
    await ctx.store.appendLog('audit.log', `fix run ${run.id} scope=${body.scope.kind} branch=${run.branch}`)
    return run
  })
  router.get('/api/fix/runs', () => fix().list())
  router.get('/api/fix/runs/:id', ({ params }) => {
    const run = fix().get(params.id ?? '')
    if (!run) throw new PerfAgentError('NOT_FOUND', 'Fix run not found')
    return run
  })
  router.post('/api/fix/runs/:id/accept', async ({ params, json }) => {
    const { changeIds, edits } = await json<{ changeIds: string[]; edits?: Record<string, string> }>()
    return fix().accept(params.id ?? '', changeIds, edits)
  })
  router.post('/api/fix/runs/:id/skip', async ({ params, json }) => {
    const { changeIds } = await json<{ changeIds: string[] }>()
    return fix().skip(params.id ?? '', changeIds)
  })
  router.post('/api/fix/runs/:id/undo', ({ params }) => fix().undo(params.id ?? ''))
}
