import type { DetectedValue, Report } from '@perfagent/core'

export type ImportFormat =
  | 'perfagent'
  | 'lighthouse'
  | 'psi'
  | 'har'
  | 'trace'
  | 'bundle-stats'
  | 'otel'
  | 'web-vitals'
  | 'csv'
  | 'pdf'
  | 'xlsx'
  | 'docx'
  | 'text'
  | 'dashboard-link'

export interface ImportInput {
  /** Raw bytes for binary formats (PDF, Excel, Word). */
  buffer?: Uint8Array
  /** Text for pasted content or text formats. */
  text?: string
  filename?: string
  /** Hint when the caller already knows the format. */
  format?: ImportFormat
}

export interface ImportResult {
  format: ImportFormat
  report: Report
  /** Values read from human documents, with confidence; the UI shows a check step for these. */
  detected: DetectedValue[]
  /** Low-confidence or missing things the user should know. */
  warnings: string[]
  /** True for machine formats where every value is exact. */
  exact: boolean
}

export interface Importer {
  format: ImportFormat
  /** Cheap sniff on the first bytes / parsed JSON. */
  matches: (input: ImportInput, parsedJson: unknown) => boolean
  run: (input: ImportInput, parsedJson: unknown) => Promise<ImportResult>
}
