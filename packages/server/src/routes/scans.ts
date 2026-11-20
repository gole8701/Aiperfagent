import { PerfAgentError, type Report } from '@perfagent/core'
import { retestIssue, runScan, type ScanRequest } from '@perfagent/engine'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

export function scanRoutes(router: Router, ctx: AppContext): void {
  router.post('/api/scans', async ({ json }) => {
    const body = await json<Partial<ScanRequest> & { routes?: string[] }>()
    if (ctx.staticBuild)
      throw new PerfAgentError(
        'NOT_LOCAL_MODE',
        'Scans run only in the installed tool.',
        'Run "npx perfagent" in your project.',
      )
    const request: ScanRequest = {
      urls: body.urls?.length ? body.urls : ctx.config.urls,
      project: body.project ?? ctx.mode.mode === 'local',
      device: body.device,
      runs: body.runs,
      label: body.label,
      environmentName: body.environmentName,
      mode: body.project === false || ctx.mode.mode !== 'local' ? 'deployed' : 'local',
      allowLoopback: ctx.mode.mode === 'local',
    }
    const job = ctx.jobs.enqueue<Report>(
      'scan',
      async (report) => {
        const result = await runScan(request, {
          config: ctx.config,
          onProgress: (p) => {
            report(p)
            ctx.hub.broadcast({ type: 'scan:progress', jobId: job.id, ...p })
          },
        })
        await ctx.store.save(result)
        return result
      },
      (done) => {
        if (done.status === 'done' && done.result)
          ctx.hub.broadcast({ type: 'scan:done', jobId: done.id, reportId: done.result.id })
        else
          ctx.hub.broadcast({
            type: 'scan:error',
            jobId: done.id,
            message: done.error ?? 'Scan failed',
          })
      },
    )
    return { jobId: job.id }
  })

  router.get('/api/jobs/:id', ({ params }) => {
    const job = ctx.jobs.get(params.id ?? '')
    if (!job) throw new PerfAgentError('NOT_FOUND', 'Job not found')
    const { result: _r, ...rest } = job
    return {
      ...rest,
      reportId: job.status === 'done' ? (job.result as Report | undefined)?.id : undefined,
    }
  })

  router.get('/api/scans', () => ctx.store.list())
  router.get('/api/scans/latest', async () => {
    const report = await ctx.store.latest()
    if (!report)
      throw new PerfAgentError('NOT_FOUND', 'No scans yet', 'Click Scan to measure your project.')
    return report
  })
  router.get('/api/scans/:id', ({ params }) => ctx.store.get(params.id ?? ''))
  router.delete('/api/scans/:id', async ({ params }) => {
    await ctx.store.delete(params.id ?? '')
  })
  router.post('/api/scans/:id/annotate', async ({ params, json }) => {
    const { annotation } = await json<{ annotation: string }>()
    await ctx.store.annotate(params.id ?? '', annotation.slice(0, 200))
  })

  /** Re-test one problem's page and record predicted vs actual. */
  router.post('/api/scans/:id/retest', async ({ params, json }) => {
    const { issueId } = await json<{ issueId: string }>()
    const report = await ctx.store.get(params.id ?? '')
    const issue = report.issues.find((i) => i.id === issueId)
    if (!issue) throw new PerfAgentError('NOT_FOUND', 'Problem not found in this report')
    const job = ctx.jobs.enqueue('retest', async () => {
      const { issue: verified } = await retestIssue(report, issue, { config: ctx.config })
      await ctx.store.updateIssue(report.id, issue.id, { verified: verified.verified })
      return verified
    })
    return { jobId: job.id }
  })
}
