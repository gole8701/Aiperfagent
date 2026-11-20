import { readFile } from 'node:fs/promises'

import type { Issue } from '@perfagent/core'
import { guardPath, redactText } from '@perfagent/security'

import type { AiContextFile } from './services.js'

/**
 * Gathers the code an AI needs to explain or fix an issue: the file at the
 * location (or just a window around the line when `sendCode` is `snippets`)
 * plus its local imports. Always through the path guard and the redactor.
 */
export async function gatherContext(
  root: string,
  issues: Issue[],
  sendCode: 'snippets' | 'files' | 'none',
  imports: (file: string) => string[] = () => [],
): Promise<AiContextFile[]> {
  if (sendCode === 'none') return []
  const files = new Map<string, AiContextFile>()
  for (const issue of issues) {
    const file = issue.location?.file
    if (!file || files.has(file)) continue
    const guarded = await guardPath(root, file).catch(() => undefined)
    if (!guarded) continue
    const text = await readFile(guarded.absolute, 'utf8').catch(() => '')
    if (!text) continue
    files.set(file, {
      path: file,
      text:
        sendCode === 'files'
          ? redactText(text)
          : redactText(window(text, issue.location?.line ?? 1)),
    })
    if (sendCode === 'files') {
      for (const dep of imports(file).slice(0, 5)) {
        if (files.has(dep)) continue
        const g = await guardPath(root, dep).catch(() => undefined)
        if (!g) continue
        const depText = await readFile(g.absolute, 'utf8').catch(() => '')
        if (depText && depText.length < 40_000)
          files.set(dep, { path: dep, text: redactText(depText) })
      }
    }
  }
  return [...files.values()]
}

function window(text: string, line: number, radius = 30): string {
  const lines = text.split('\n')
  const start = Math.max(0, line - 1 - radius)
  const end = Math.min(lines.length, line + radius)
  return lines
    .slice(start, end)
    .map((l, i) => `${String(start + i + 1).padStart(4)}| ${l}`)
    .join('\n')
}
