import { isReportLike, parseReport } from '@perfagent/report-schema'

import type { Importer } from '../types.js'

export const perfagentImporter: Importer = {
  format: 'perfagent',
  matches: (_input, json) =>
    isReportLike(json) && (json as { tool: { name: string } }).tool.name === 'perfagent',
  run: (input, json) => {
    const report = parseReport(json)
    return Promise.resolve({
      format: 'perfagent',
      report: { ...report, label: report.label ?? input.filename },
      detected: [],
      warnings: [],
      exact: true,
    })
  },
}
