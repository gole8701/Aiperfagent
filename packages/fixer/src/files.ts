import { readFile, writeFile } from 'node:fs/promises'

import type { CodeChange } from '@perfagent/core'
import { guardPath, matchesAnyGlob } from '@perfagent/security'

/**
 * Original bytes of every file a run touched, keyed by relative path. Undo and
 * rollback restore from here, so they return the exact bytes, not a re-encoding.
 */
export type Backups = Map<string, Buffer>

export interface RejectedChange {
  change: CodeChange
  reason: string
}

/** Path guard + protected globs. The relative path is the real one (symlinks resolved). */
export async function vetChange(
  root: string,
  change: CodeChange,
  protectedGlobs: string[],
): Promise<{ relative: string; absolute: string } | RejectedChange> {
  let guarded: { relative: string; absolute: string }
  try {
    guarded = await guardPath(root, change.file)
  } catch (error) {
    return { change, reason: error instanceof Error ? error.message : 'outside the project' }
  }
  if (
    matchesAnyGlob(guarded.relative, protectedGlobs) ||
    matchesAnyGlob(change.file, protectedGlobs)
  )
    return { change, reason: `${change.file} is protected by fix.protected` }
  return guarded
}

export function isRejected(value: unknown): value is RejectedChange {
  return typeof value === 'object' && value !== null && 'reason' in value
}

/** Replaces the first occurrence of `before`, keeping the file's own line endings. Throws when `before` is not there. */
export async function applyChange(
  absolute: string,
  relative: string,
  change: CodeChange,
  backups: Backups,
): Promise<void> {
  const original = await readFile(absolute)
  if (!backups.has(relative)) backups.set(relative, original)
  const text = original.toString('utf8')
  const crlf = text.includes('\r\n')
  const before = crlf ? change.before.replace(/\r?\n/g, '\r\n') : change.before
  const index = text.indexOf(before)
  if (index < 0) throw new Error(`The text to replace was not found in ${relative}`)
  const after = crlf ? change.after.replace(/\r?\n/g, '\r\n') : change.after
  await writeFile(
    absolute,
    text.slice(0, index) + after + text.slice(index + before.length),
    'utf8',
  )
}

export async function restore(
  root: string,
  backups: Backups,
  files?: Iterable<string>,
): Promise<void> {
  for (const relative of files ?? backups.keys()) {
    const bytes = backups.get(relative)
    if (!bytes) continue
    const guarded = await guardPath(root, relative).catch(() => undefined)
    if (guarded) await writeFile(guarded.absolute, bytes)
  }
}
