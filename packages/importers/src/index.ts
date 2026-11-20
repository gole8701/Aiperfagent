import { PerfAgentError } from '@perfagent/core'
import { MAX_IMPORT_BYTES } from '@perfagent/report-schema'
import { redact } from '@perfagent/security'

import { bundleStatsImporter } from './formats/bundle-stats.js'
import { csvImporter } from './formats/csv.js'
import { docxImporter } from './formats/docx.js'
import { harImporter } from './formats/har.js'
import { lighthouseImporter, psiImporter } from './formats/lighthouse.js'
import { otelImporter } from './formats/otel.js'
import { pdfImporter } from './formats/pdf.js'
import { perfagentImporter } from './formats/perfagent.js'
import { textImporter } from './formats/text.js'
import { traceImporter } from './formats/trace.js'
import { webVitalsImporter } from './formats/web-vitals.js'
import { xlsxImporter } from './formats/xlsx.js'
import type { ImportInput, ImportResult, Importer } from './types.js'

export type { ImportFormat, ImportInput, ImportResult, Importer } from './types.js'
export { emptyReport, pageFromMetrics, detectedFrom, parseHumanNumber, unitOf, routeOf } from './report-builder.js'
export { detectMetricsInText } from './text-metrics.js'
export { metricForLabel, routeInText } from './metric-aliases.js'
export { looksLikeReportLink } from './report-link.js'

/** Registry. Order matters: exact machine formats first, documents next, pasted text last. */
export const importers: Importer[] = [
  perfagentImporter, psiImporter, lighthouseImporter, harImporter, traceImporter, bundleStatsImporter, otelImporter, webVitalsImporter,
  csvImporter, pdfImporter, xlsxImporter, docxImporter, textImporter,
]

export function registerImporter(importer: Importer): void {
  importers.push(importer)
}

/** Rejects anything over the hard cap before a single byte is parsed. */
export function assertImportSize(size: number): void {
  if (size > MAX_IMPORT_BYTES) throw new PerfAgentError('IMPORT_TOO_LARGE', `This file is ${Math.round(size / 1_048_576)} MB; the limit is ${MAX_IMPORT_BYTES / 1_048_576} MB.`)
  if (size === 0) throw new PerfAgentError('IMPORT_INVALID', 'The file is empty.')
}

/** Detects the format and converts. Throws a plain-language PerfAgentError when nothing matches. */
export async function importReport(input: ImportInput): Promise<ImportResult> {
  assertImportSize(input.buffer?.byteLength ?? Buffer.byteLength(input.text ?? ''))
  const text = input.text ?? (looksText(input) ? Buffer.from(input.buffer ?? []).toString('utf8') : undefined)
  const json = text ? tryJson(text) : undefined
  const normalized: ImportInput = { ...input, text }
  const candidates = input.format ? importers.filter((i) => i.format === input.format) : importers
  for (const importer of candidates) {
    if (!importer.matches(normalized, json)) continue
    const result = await importer.run(normalized, json)
    return { ...result, report: redact(result.report) }
  }
  throw new PerfAgentError('IMPORT_INVALID', 'PerfAgent could not recognise this file.', 'Supported: PerfAgent JSON, Lighthouse, PageSpeed, HAR, Chrome trace, bundle stats, OpenTelemetry, web-vitals, CSV, PDF, Excel, Word, pasted text.')
}

function tryJson(text: string): unknown {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function looksText(input: ImportInput): boolean {
  const name = input.filename?.toLowerCase() ?? ''
  if (/\.(pdf|xlsx|xls|docx)$/.test(name)) return false
  const head = input.buffer?.subarray(0, 4) ?? new Uint8Array()
  // %PDF, PK (zip: xlsx/docx)
  return !(head[0] === 0x25 && head[1] === 0x50) && !(head[0] === 0x50 && head[1] === 0x4b)
}
