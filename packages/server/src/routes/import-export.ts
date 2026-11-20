import { PerfAgentError } from '@perfagent/core'
import { budgetsMarkdown, checkBudgets } from '@perfagent/engine'
import { importReport, type ImportFormat } from '@perfagent/importers'

import type { AppContext } from '../app.js'
import { exportReport, type ExportFormat } from '../export.js'
import type { Router } from '../router.js'

export function importExportRoutes(router: Router, ctx: AppContext): void {
  /** Raw body upload; filename and optional format come from headers so any file type works. */
  router.post('/api/import', async ({ req, raw, query }) => {
    const buffer = await raw()
    const filename = decodeURIComponent(
      String(req.headers['x-filename'] ?? query.get('filename') ?? ''),
    )
    const format = (query.get('format') ?? undefined) as ImportFormat | undefined
    const result = await importReport({ buffer, filename: filename || undefined, format })
    if (query.get('save') !== 'false') await ctx.store.save(result.report)
    return {
      reportId: result.report.id,
      format: result.format,
      exact: result.exact,
      detected: result.detected,
      warnings: result.warnings,
      report: result.report,
    }
  })

  router.post('/api/import/text', async ({ json }) => {
    const { text, filename } = await json<{ text: string; filename?: string }>()
    if (typeof text !== 'string')
      throw new PerfAgentError('IMPORT_INVALID', 'Paste some text first')
    const result = await importReport({ text, filename })
    await ctx.store.save(result.report)
    return {
      reportId: result.report.id,
      format: result.format,
      exact: result.exact,
      detected: result.detected,
      warnings: result.warnings,
      report: result.report,
    }
  })

  /** Lets the user correct low-confidence values detected from a PDF/Word/Excel import. */
  router.post('/api/import/:id/correct', async ({ params, json }) => {
    const { values } = await json<{ values: { metric: string; value: number; route?: string }[] }>()
    const report = await ctx.store.get(params.id ?? '')
    for (const v of values) {
      const page = report.pages.find((p) => !v.route || p.route === v.route) ?? report.pages[0]
      const metric = page?.metrics.find((m) => m.id === v.metric)
      if (metric && Number.isFinite(v.value)) metric.value = v.value
      const detected = report.detected?.find(
        (d) => d.metric === v.metric && (!v.route || d.route === v.route),
      )
      if (detected) {
        detected.value = v.value
        detected.confidence = 1
      }
    }
    await ctx.store.save(report)
    return report
  })

  router.get('/api/export/:id', async ({ params, query, res }) => {
    const report = await ctx.store.get(params.id ?? '')
    const format = (query.get('format') ?? 'json') as ExportFormat
    if (!['json', 'csv', 'md', 'html'].includes(format))
      throw new PerfAgentError('IMPORT_INVALID', 'Format must be json, csv, md or html')
    const out = exportReport(report, format)
    res.writeHead(200, {
      'Content-Type': `${out.contentType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${out.filename}"`,
    })
    res.end(out.body)
  })

  router.get('/api/budgets/:id', async ({ params }) => {
    const report = await ctx.store.get(params.id ?? '')
    const results = checkBudgets(report, ctx.config.budgets)
    return {
      results,
      markdown: budgetsMarkdown(report, results),
      passed: results.every((r) => r.passed),
    }
  })
}
