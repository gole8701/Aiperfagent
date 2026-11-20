import { PerfAgentError, errorMessage } from '@perfagent/core'

import { resultFromDetected } from '../detected-report.js'
import { detectMetricsInText } from '../text-metrics.js'
import type { Importer } from '../types.js'

interface TextItem {
  str?: string
  transform?: number[]
  hasEOL?: boolean
}

const isPdf = (buffer: Uint8Array | undefined): boolean =>
  buffer?.[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46

/** Rebuilds lines from positioned text runs: same baseline (y) → same line, ordered by x. */
function linesOf(items: TextItem[]): string[] {
  const rows = new Map<number, { x: number; text: string }[]>()
  for (const item of items) {
    const text = item.str?.trim()
    if (!text) continue
    const y = Math.round(item.transform?.[5] ?? 0)
    const x = item.transform?.[4] ?? 0
    rows.set(y, [...(rows.get(y) ?? []), { x, text }])
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, runs]) =>
      runs
        .sort((a, b) => a.x - b.x)
        .map((r) => r.text)
        .join(' '),
    )
}

/** Loaded lazily: pdf.js is several MB and most imports never need it. No worker, no font loading, no logging. */
export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    verbosity: 0,
  })
  try {
    const doc = await task.promise
    const pages: string[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      pages.push(linesOf(content.items as TextItem[]).join('\n'))
    }
    return pages.join('\n\n')
  } finally {
    await task.destroy()
  }
}

export const pdfImporter: Importer = {
  format: 'pdf',
  matches: (input) => isPdf(input.buffer) || /\.pdf$/i.test(input.filename ?? ''),
  run: async (input) => {
    let text: string
    try {
      text = await extractPdfText(input.buffer ?? new Uint8Array())
    } catch (error) {
      throw new PerfAgentError(
        'IMPORT_INVALID',
        `This PDF could not be read (${errorMessage(error)}).`,
        'Export the report again, or copy its text and paste it instead.',
      )
    }
    return resultFromDetected(
      'pdf',
      detectMetricsInText(text, input.filename ?? 'PDF'),
      input,
      text,
    )
  },
}
