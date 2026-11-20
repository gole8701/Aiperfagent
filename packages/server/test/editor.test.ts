import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const calls: { bin: string; args: string[] }[] = []

// `code` is missing from PATH; `open` (macOS) succeeds.
vi.mock('node:child_process', () => ({
  execFile: (bin: string, args: string[], _opts: unknown, cb: (error: Error | null) => void) => {
    calls.push({ bin, args })
    const child = new EventEmitter()
    setTimeout(() => {
      if (bin === 'open') cb(null)
      else child.emit('error', new Error('ENOENT'))
    }, 0)
    return child
  },
}))

const { openInEditor } = await import('../src/editor.js')

const platform = process.platform
afterEach(() => {
  Object.defineProperty(process, 'platform', { value: platform })
  calls.length = 0
})

describe('openInEditor', () => {
  it('opens VS Code by bundle id on macOS when the code command is missing', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    const root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-editor-'))
    try {
      await writeFile(path.join(root, 'a.ts'), '')
      const result = await openInEditor(root, 'a.ts', 3, 1, 'vscode')
      expect(result.opened).toBe(true)
      const open = calls.find((c) => c.bin === 'open')
      expect(open?.args[0]).toBe('-b')
      expect(open?.args[1]).toBe('com.microsoft.VSCode')
      expect(open?.args[2]).toMatch(/^vscode:\/\/file\/.*a\.ts:3:1$/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports the missing command elsewhere', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const root = await mkdtemp(path.join(os.tmpdir(), 'perfagent-editor-'))
    try {
      await writeFile(path.join(root, 'a.ts'), '')
      await expect(openInEditor(root, 'a.ts', 3, 1, 'vscode')).rejects.toThrow(/not found/)
      expect(calls.some((c) => c.bin === 'open')).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
