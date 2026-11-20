import { access } from 'node:fs/promises'
import path from 'node:path'

import type { EnvironmentMode } from '@perfagent/core'

export interface ModeCheck {
  mode: EnvironmentMode
  /** Every reason local mode was refused. Empty when local. */
  reasons: string[]
  hasGit: boolean
}

export interface ModeInput {
  root: string
  bindHost: string
  env?: NodeJS.ProcessEnv
  /** Set by the static/hosted build; such a build has no write code at all. */
  staticBuild?: boolean
}

/**
 * Local mode needs all of: loopback bind, a git repository, NODE_ENV not
 * production, and not the static build. Otherwise the tool is suggest-only.
 */
export async function detectMode(input: ModeInput): Promise<ModeCheck> {
  const env = input.env ?? process.env
  const reasons: string[] = []
  const hasGit = await insideGitRepo(path.resolve(input.root))
  if (input.staticBuild) reasons.push('This is the hosted/static build')
  if (!['127.0.0.1', 'localhost', '::1'].includes(input.bindHost)) reasons.push('Server is not bound to the loopback address')
  if (env.NODE_ENV === 'production' && env.PERFAGENT_FORCE_LOCAL !== 'true') reasons.push('NODE_ENV is "production"')
  if (!hasGit) reasons.push('Project folder is not a git repository (needed for the safe fix branch)')
  return { mode: reasons.length ? 'deployed' : 'local', reasons, hasGit }
}

/** Projects often live in a subfolder of the repo (monorepos), so walk up like git does. */
async function insideGitRepo(dir: string): Promise<boolean> {
  for (let d = dir; ; d = path.dirname(d)) {
    if (await exists(path.join(d, '.git'))) return true
    if (path.dirname(d) === d) return false
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}
