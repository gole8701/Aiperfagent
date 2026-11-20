import { realpath } from 'node:fs/promises'
import path from 'node:path'

import { PerfAgentError } from '@perfagent/core'

/** Files nobody may read or open through the tool, even inside the root. */
const BLOCKED_NAMES = [
  /^\.env(\..*)?$/,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /^id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /credentials\.json$/i,
]
const BLOCKED_DIRS = ['.git', 'node_modules', '.perfagent']

export interface GuardedPath {
  absolute: string
  relative: string
}

/**
 * Resolves `requested` inside `root` and proves (via realpath) that it stays
 * there. Symlinks that point outside, `..` tricks and blocked files all throw.
 */
export async function guardPath(
  root: string,
  requested: string,
  options: { allowMissing?: boolean } = {},
): Promise<GuardedPath> {
  if (requested.includes('\0')) throw outside(requested)
  const rootReal = await realpath(root)
  const candidate = path.resolve(rootReal, requested)
  if (!isInside(rootReal, candidate)) throw outside(requested)

  let resolved = candidate
  try {
    resolved = await realpath(candidate)
  } catch (error) {
    if (!options.allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw outside(requested)
    // The file doesn't exist yet (a fix will create it): the parent must still be inside.
    const parentReal = await realpath(path.dirname(candidate)).catch(() => {
      throw outside(requested)
    })
    resolved = path.join(parentReal, path.basename(candidate))
  }
  if (!isInside(rootReal, resolved)) throw outside(requested)

  const relative = path.relative(rootReal, resolved).split(path.sep).join('/')
  if (isBlocked(relative)) {
    throw new PerfAgentError(
      'PATH_OUTSIDE_ROOT',
      `"${relative}" is a protected file and is never read.`,
      'Secrets, keys and dependency internals stay private.',
    )
  }
  return { absolute: resolved, relative }
}

export function isBlocked(relative: string): boolean {
  const parts = relative.split('/')
  if (parts.some((p) => BLOCKED_DIRS.includes(p))) return true
  const name = parts[parts.length - 1] ?? ''
  return BLOCKED_NAMES.some((re) => re.test(name))
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function outside(requested: string): PerfAgentError {
  return new PerfAgentError(
    'PATH_OUTSIDE_ROOT',
    `"${requested}" is outside the project folder.`,
    'Only files inside the project root can be opened or changed.',
  )
}

/** Simple glob → RegExp for `fix.protected` patterns (`src/payments/**`, `*.config.js`). */
export function globToRegExp(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] ?? ''
    if (ch === '*' && glob[i + 1] === '*') {
      const slashAfter = glob[i + 2] === '/'
      out += slashAfter ? '(?:.*/)?' : '.*'
      i += slashAfter ? 2 : 1
    } else if (ch === '*') out += '[^/]*'
    else if (ch === '?') out += '[^/]'
    else out += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch
  }
  return new RegExp(`^${out}$`)
}

export function matchesAnyGlob(relative: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(relative))
}
