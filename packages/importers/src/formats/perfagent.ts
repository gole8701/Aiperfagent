import { isReportLike, parseReport } from '@perfagent/report-schema'

import type { Importer } from '../types.js'

export const perfagentImporter: Importer = {
  format: 'perfagent',
  matches: (_input, json) => isReportLike(json) && (json as { tool: { name: string } }).tool.name === 'perfagent',
  run: (_input, json) => Promise.resolve({ format: 'perfagent', report: parseReport(json), detected: [], warnings: [], exact: true }),
}
