import { execFile } from 'node:child_process'

import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError } from '@perfagent/core'
import { guardPath } from '@perfagent/security'
import launch from 'launch-editor'

type EditorId = PerfAgentConfig['editor']

/** Command + argument template per editor. `{file}`, `{line}`, `{column}` are replaced; never joined into a shell string. */
const COMMANDS: Record<
  Exclude<EditorId, 'auto'>,
  { bin: string[]; args: (f: string, l: number, c: number) => string[] }
> = {
  vscode: { bin: ['code'], args: (f, l, c) => ['--goto', `${f}:${l}:${c}`] },
  cursor: { bin: ['cursor'], args: (f, l, c) => ['--goto', `${f}:${l}:${c}`] },
  windsurf: { bin: ['windsurf'], args: (f, l, c) => ['--goto', `${f}:${l}:${c}`] },
  zed: { bin: ['zed'], args: (f, l, c) => [`${f}:${l}:${c}`] },
  sublime: { bin: ['subl'], args: (f, l, c) => [`${f}:${l}:${c}`] },
  jetbrains: {
    bin: ['webstorm', 'idea', 'phpstorm', 'pycharm'],
    args: (f, l) => ['--line', String(l), f],
  },
  vim: { bin: ['vim'], args: (f, l) => [`+${l}`, f] },
  neovim: { bin: ['nvim'], args: (f, l) => [`+${l}`, f] },
  emacs: { bin: ['emacsclient', 'emacs'], args: (f, l, c) => [`+${l}:${c}`, f] },
  'notepad++': { bin: ['notepad++'], args: (f, l, c) => [`-n${l}`, `-c${c}`, f] },
}

export const EDITOR_LABELS: Record<EditorId, string> = {
  auto: 'Auto-detect (system default)',
  vscode: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  zed: 'Zed',
  sublime: 'Sublime Text',
  jetbrains: 'WebStorm / IntelliJ (JetBrains)',
  vim: 'Vim',
  neovim: 'Neovim',
  emacs: 'Emacs',
  'notepad++': 'Notepad++',
}

/** URL schemes for the dashboard's fallback link when the server cannot launch the editor. */
export function editorUrl(
  editor: EditorId,
  absolute: string,
  line: number,
  column = 1,
): string | undefined {
  const file = encodeURI(absolute)
  switch (editor) {
    case 'vscode':
      return `vscode://file${file}:${line}:${column}`
    case 'cursor':
      return `cursor://file${file}:${line}:${column}`
    case 'windsurf':
      return `windsurf://file${file}:${line}:${column}`
    case 'zed':
      return `zed://file${file}:${line}:${column}`
    case 'sublime':
      return `subl://open?url=file://${file}&line=${line}&column=${column}`
    case 'jetbrains':
      return `jetbrains://open?file=${file}&line=${line}`
    default:
      return undefined
  }
}

export async function openInEditor(
  root: string,
  file: string,
  line: number,
  column: number,
  editor: EditorId,
): Promise<{ opened: boolean; absolute: string; fallbackUrl?: string; message: string }> {
  const { absolute } = await guardPath(root, file)
  if (editor === 'auto') {
    const failure = await new Promise<string | undefined>((resolve) => {
      launch(
        `${absolute}:${line}:${column}`,
        process.env.EDITOR,
        (fileName: string, errorMessage: string | null) => {
          resolve(`Could not open ${fileName}: ${errorMessage ?? 'no editor found'}.`)
        },
      )
      // launch-editor only calls back on failure; give it a moment to fail.
      setTimeout(() => resolve(undefined), 400)
    })
    if (!failure) return { opened: true, absolute, message: 'Opened in your editor' }
    if (await openVsCodeOnMac(absolute, line, column))
      return { opened: true, absolute, message: 'Opened in VS Code' }
    return {
      opened: false,
      absolute,
      message: `${failure} Set "editor" in perfagent.config or the EDITOR environment variable.`,
    }
  }
  const spec = COMMANDS[editor]
  const args = spec.args(absolute, line, column)
  for (const bin of spec.bin) {
    const ok = await tryExec(bin, args)
    if (ok) return { opened: true, absolute, message: `Opened in ${EDITOR_LABELS[editor]}` }
  }
  if (editor === 'vscode' && (await openVsCodeOnMac(absolute, line, column)))
    return { opened: true, absolute, message: 'Opened in VS Code' }
  const fallbackUrl = editorUrl(editor, absolute, line, column)
  throw new PerfAgentError(
    'NOT_FOUND',
    `${EDITOR_LABELS[editor]} command not found on PATH.`,
    fallbackUrl
      ? 'Use the link in the dashboard, or install the editor’s command-line tool.'
      : 'Install the editor’s command-line tool.',
  ).withDetail({ fallbackUrl, absolute })
}

/**
 * macOS: VS Code is often installed without the `code` command on PATH. Hand its
 * `vscode://` link to VS Code by bundle id; `open` fails when VS Code is not installed.
 */
function openVsCodeOnMac(absolute: string, line: number, column: number): Promise<boolean> {
  if (process.platform !== 'darwin') return Promise.resolve(false)
  const url = editorUrl('vscode', absolute, line, column) ?? ''
  return new Promise((resolve) => {
    execFile('open', ['-b', 'com.microsoft.VSCode', url], { timeout: 5000 }, (error) =>
      resolve(!error),
    )
  })
}

function tryExec(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = execFile(bin, args, { timeout: 5000, windowsHide: true }, (error) =>
      resolve(!error),
    )
    child.on('error', () => resolve(false))
    // GUI editors detach immediately; treat a clean spawn as success.
    child.on('spawn', () => setTimeout(() => resolve(true), 300))
  })
}

declare module '@perfagent/core' {
  interface PerfAgentError {
    detail?: Record<string, unknown>
    withDetail(detail: Record<string, unknown>): PerfAgentError
  }
}
PerfAgentError.prototype.withDetail = function withDetail(
  this: PerfAgentError,
  detail: Record<string, unknown>,
): PerfAgentError {
  this.detail = detail
  return this
}
