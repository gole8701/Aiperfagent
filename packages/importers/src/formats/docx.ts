import { PerfAgentError, errorMessage } from '@perfagent/core'

import { resultFromDetected } from '../detected-report.js'
import { detectMetricsInText } from '../text-metrics.js'
import type { Importer } from '../types.js'

import { zipHas } from './xlsx.js'

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

/** Mammoth's HTML keeps table rows together; raw text would split every cell onto its own line. */
export function htmlToLines(html: string): string {
  return html
    .replace(/<\/p>\s*<\/t([dh])>/gi, '</t$1>')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/(tr|p|h\d|li|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

export async function extractDocxText(buffer: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth')
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
  return htmlToLines(value)
}

export const docxImporter: Importer = {
  format: 'docx',
  matches: (input) => /\.docx$/i.test(input.filename ?? '') || zipHas(input.buffer, 'word/'),
  run: async (input) => {
    let text: string
    try {
      text = await extractDocxText(input.buffer ?? new Uint8Array())
    } catch (error) {
      throw new PerfAgentError('IMPORT_INVALID', `This Word file could not be read (${errorMessage(error)}).`, 'Save it again as .docx, or copy its text and paste it instead.')
    }
    return resultFromDetected('docx', detectMetricsInText(text, input.filename ?? 'Word'), input, text)
  },
}
