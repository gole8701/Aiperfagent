import { PerfAgentError, compareReports, type Report } from '@perfagent/core'
import { runScan } from '@perfagent/engine'
import { importReport } from '@perfagent/importers'

import type { AppContext } from '../app.js'
import type { Router } from '../router.js'

/** A compare source: saved scan, fresh URL scan, pasted text/JSON, or a PerfAgent dashboard/report link. */
export type CompareSource =
  | { kind: 'report'; reportId: string }
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string; filename?: string }
  | { kind: 'link'; url: string }

export function compareRoutes(router: Router, ctx: AppContext): void {
  router.post('/api/compare', async ({ json }) => {
    const body = await json<{ sources: CompareSource[]; routeA?: string; routeB?: string }>()
    if (!Array.isArray(body.sources) || body.sources.length < 2)
      throw new PerfAgentError('IMPORT_INVALID', 'Pick at least two things to compare')
    const reports: Report[] = []
    for (const source of body.sources.slice(0, 5)) reports.push(await resolveSource(ctx, source))
    const [a, b, ...rest] = reports
    if (!a || !b) throw new PerfAgentError('IMPORT_INVALID', 'Two sources are needed')
    const main = compareReports(a, b, { routeA: body.routeA, routeB: body.routeB })
    // Extra sources (C, D…) each compared against the first, for release-after-release views.
    const extra = rest.map((r) => compareReports(a, r))
    return {
      comparison: main,
      extra,
      reports: reports.map((r) => ({
        id: r.id,
        label: r.label ?? r.environment.name,
        createdAt: r.createdAt,
        pages: r.pages.map((p) => p.route),
      })),
    }
  })
}

async function resolveSource(ctx: AppContext, source: CompareSource): Promise<Report> {
  switch (source.kind) {
    case 'report':
      return ctx.store.get(source.reportId)
    case 'text': {
      const result = await importReport({ text: source.text, filename: source.filename })
      await ctx.store.save(result.report)
      return result.report
    }
    case 'link': {
      // A PerfAgent dashboard link carries ?token=…&report=<id>; a shared report link ends in .json.
      const url = new URL(source.url)
      const id = url.searchParams.get('report') ?? url.searchParams.get('reportId')
      if (id) return ctx.store.get(id)
      if (url.pathname.endsWith('.json')) {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        const result = await importReport({ text: await res.text(), filename: url.pathname })
        return result.report
      }
      throw new PerfAgentError(
        'IMPORT_INVALID',
        'That link is not a PerfAgent report',
        'Paste a dashboard link with ?report=… or a link to an exported .json file.',
      )
    }
    case 'url': {
      if (ctx.staticBuild)
        throw new PerfAgentError('NOT_LOCAL_MODE', 'Fresh scans need the installed tool')
      const report = await runScan(
        {
          urls: [source.url],
          project: false,
          runs: 3,
          mode: 'deployed',
          label: source.url,
          allowLoopback: ctx.mode.mode === 'local',
        },
        { config: ctx.config },
      )
      await ctx.store.save(report)
      return report
    }
  }
}
