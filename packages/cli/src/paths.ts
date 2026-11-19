import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Where the built dashboard and the guides live. Published package: next to
 * dist/. Monorepo: in the web package and docs folder.
 */
export async function dashboardDir(): Promise<string | undefined> {
  return firstExisting([path.join(here, '..', 'dashboard'), path.join(here, '..', '..', 'web', 'dist')])
}

export async function guidesDir(): Promise<string | undefined> {
  return firstExisting([path.join(here, '..', 'guides'), path.join(here, '..', '..', '..', 'docs', 'guides')])
}

export async function agentScriptPath(): Promise<string | undefined> {
  return firstExisting([path.join(here, '..', 'dashboard', 'perfagent.js'), path.join(here, '..', '..', 'agent', 'dist', 'perfagent.js')])
}

async function firstExisting(candidates: string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      await access(path.join(candidate))
      return candidate
    } catch {
      /* next */
    }
  }
  return undefined
}
