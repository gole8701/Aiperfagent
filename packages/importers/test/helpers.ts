import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { metricValue, type MetricId, type PageResult } from '@perfagent/core'
import { parseReport } from '@perfagent/report-schema'

import { importReport, type ImportResult } from '../src/index.js'

export const fixtures = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/reports',
)

/** Imports a fixture by name and checks the result is a valid report. */
export async function importFixture(name: string): Promise<ImportResult> {
  const result = await importReport({
    buffer: await readFile(path.join(fixtures, name)),
    filename: name,
  })
  expectValid(result)
  return result
}

export function expectValid(result: ImportResult): void {
  parseReport(result.report)
  if (result.report.label === undefined) throw new Error('label missing')
}

export function metric(page: PageResult | undefined, id: MetricId): number | undefined {
  return page ? metricValue(page.metrics, id) : undefined
}

export function pageAt(result: ImportResult, route: string): PageResult | undefined {
  return result.report.pages.find((p) => p.route === route)
}
