import { readFile } from 'node:fs/promises'

import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import { guardPath, redactText } from '@perfagent/security'

import type { AppContext } from '../app.js'
import { EDITOR_LABELS, editorUrl, openInEditor } from '../editor.js'
import type { Router } from '../router.js'

/** Local-mode-only routes. Not registered in deployed or static builds. */
export function localRoutes(router: Router, ctx: AppContext): void {
  router.post('/api/editor/open', async ({ json }) => {
    const body = await json<{
      file: string
      line?: number
      column?: number
      editor?: PerfAgentConfig['editor']
    }>()
    if (!body.file) throw new PerfAgentError('IMPORT_INVALID', 'No file given')
    const editor = body.editor && body.editor in EDITOR_LABELS ? body.editor : ctx.config.editor
    try {
      return await openInEditor(
        ctx.config.root,
        body.file,
        Math.max(1, body.line ?? 1),
        Math.max(1, body.column ?? 1),
        editor,
      )
    } catch (error) {
      if (error instanceof PerfAgentError && error.detail)
        return { opened: false, message: error.message, hint: error.hint, ...error.detail }
      throw error
    }
  })

  router.get('/api/editor/link', async ({ query }) => {
    const { absolute } = await guardPath(ctx.config.root, query.get('file') ?? '')
    const editor = (query.get('editor') ?? ctx.config.editor) as PerfAgentConfig['editor']
    return {
      url: editorUrl(
        editor,
        absolute,
        Number(query.get('line') ?? 1),
        Number(query.get('column') ?? 1),
      ),
      absolute,
    }
  })

  /** Source window for the deep dive's "before" code. Path-guarded and redacted. */
  router.get('/api/files/snippet', async ({ query }) => {
    const { absolute, relative } = await guardPath(ctx.config.root, query.get('file') ?? '')
    const line = Math.max(1, Number(query.get('line') ?? 1))
    const radius = Math.min(60, Number(query.get('radius') ?? 12))
    const text = await readFile(absolute, 'utf8')
    const lines = text.split('\n')
    const start = Math.max(0, line - 1 - radius)
    return {
      file: relative,
      startLine: start + 1,
      lines: lines.slice(start, line + radius).map(redactText),
      totalLines: lines.length,
    }
  })
}
