import { resultFromDetected } from '../detected-report.js'
import { metricForLabel } from '../metric-aliases.js'
import { detectedFromRows } from '../tabular.js'
import type { ImportInput, Importer } from '../types.js'

/** RFC 4180-style parser: quoted cells, doubled quotes, newlines inside quotes. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? ''
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function delimiterOf(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t'
  return (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','
}

function headerHasMetrics(input: ImportInput): boolean {
  const first = input.text?.split(/\r?\n/, 1)[0] ?? ''
  const cells = parseDelimited(first, delimiterOf(first))[0] ?? []
  return cells.length >= 2 && cells.some((c) => metricForLabel(c))
}

export const csvImporter: Importer = {
  format: 'csv',
  matches: (input, json) => json === undefined && (/\.(csv|tsv)$/i.test(input.filename ?? '') || headerHasMetrics(input)),
  run: (input) => {
    const text = input.text ?? ''
    const rows = parseDelimited(text, delimiterOf(text.split(/\r?\n/, 1)[0] ?? '')).map((r) => r.map((c) => c.trim()))
    const { detected, exact, createdAt } = detectedFromRows(rows, input.filename ?? 'CSV')
    return Promise.resolve(resultFromDetected('csv', detected, input, text, { exact, createdAt }))
  },
}
