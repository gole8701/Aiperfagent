import { PerfAgentError, errorMessage } from '@perfagent/core'
import type { CellValue, Worksheet } from 'exceljs'

import { resultFromDetected } from '../detected-report.js'
import { detectMetricsInText } from '../text-metrics.js'
import type { Importer } from '../types.js'

const isZip = (buffer: Uint8Array | undefined): boolean =>
  buffer?.[0] === 0x50 && buffer[1] === 0x4b

/** Formula results, rich text, hyperlinks and dates all become the text a person sees in the cell. */
function cellText(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('')
    if ('text' in value) return cellText(value.text as CellValue)
    if ('result' in value) return cellText(value.result as CellValue)
    if ('error' in value) return ''
    return ''
  }
  return String(value)
}

/** Each sheet becomes a pipe-separated table, so the text detector reads header tables and label/value pairs alike. */
function sheetLines(sheet: Worksheet): string[] {
  const lines = [sheet.name]
  sheet.eachRow((row) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellText(cell.value)))
    while (cells.length && cells[cells.length - 1] === '') cells.pop()
    if (cells.length) lines.push(cells.join(' | '))
  })
  return lines
}

export async function extractXlsxText(buffer: Uint8Array): Promise<string> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  await workbook.xlsx.load(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  )
  return workbook.worksheets.flatMap((sheet) => [...sheetLines(sheet), '']).join('\n')
}

export const xlsxImporter: Importer = {
  format: 'xlsx',
  matches: (input) =>
    /\.xlsx$/i.test(input.filename ?? '') ||
    (isZip(input.buffer) && !/\.docx$/i.test(input.filename ?? '') && zipHas(input.buffer, 'xl/')),
  run: async (input) => {
    let text: string
    try {
      text = await extractXlsxText(input.buffer ?? new Uint8Array())
    } catch (error) {
      throw new PerfAgentError(
        'IMPORT_INVALID',
        `This Excel file could not be read (${errorMessage(error)}).`,
        'Save it again as .xlsx, or export the sheet as CSV.',
      )
    }
    return resultFromDetected(
      'xlsx',
      detectMetricsInText(text, input.filename ?? 'Excel'),
      input,
      text,
    )
  },
}

/** Zip central directory lists entry names in plain ASCII; enough to tell xlsx (xl/) from docx (word/) without a name. */
export function zipHas(buffer: Uint8Array | undefined, entryPrefix: string): boolean {
  if (!buffer) return false
  const tail = Buffer.from(buffer.subarray(Math.max(0, buffer.byteLength - 65_536))).toString(
    'latin1',
  )
  return tail.includes(entryPrefix)
}
