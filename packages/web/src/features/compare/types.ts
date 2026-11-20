import type { Report } from '@perfagent/core'

import type { ImportResult } from '../../api/types'

/** One side of a comparison, as the user picked it. `report` is set once the side resolves to a saved report. */
export type SourceSpec =
  | { kind: 'empty' }
  | { kind: 'report'; reportId: string; title: string; report?: Report }
  | { kind: 'url'; url: string }
  | { kind: 'file'; result: ImportResult; title: string }
  | { kind: 'text'; text: string }
  | { kind: 'link'; url: string }

export type CompareMode = 'before-after' | 'page-vs-page' | 'many-pages'

export const MODES: { id: CompareMode; label: string }[] = [
  { id: 'before-after', label: 'Before vs after (same page)' },
  { id: 'page-vs-page', label: 'Page vs page' },
  { id: 'many-pages', label: 'Many pages' },
]

export function describeSource(source: SourceSpec): string {
  switch (source.kind) {
    case 'empty':
      return 'Nothing picked yet'
    case 'report':
      return source.title
    case 'url':
      return `Fresh scan of ${source.url}`
    case 'file':
      return `${source.title}${source.result.exact ? '' : ' · read from a document'}`
    case 'text':
      return 'Pasted text'
    case 'link':
      return `Dashboard link ${source.url}`
  }
}
