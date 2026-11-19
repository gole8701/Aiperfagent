import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Git is always called with fixed argument arrays, never a shell string. */
export async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 })
  return stdout.trim()
}

export async function gitInfo(root: string): Promise<{ commit?: string; branch?: string }> {
  try {
    const [commit, branch] = await Promise.all([git(root, ['rev-parse', 'HEAD']), git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])])
    return { commit, branch }
  } catch {
    return {}
  }
}

export async function isGitRepo(root: string): Promise<boolean> {
  return git(root, ['rev-parse', '--is-inside-work-tree']).then((o) => o === 'true').catch(() => false)
}

export async function isWorkingTreeDirty(root: string): Promise<boolean> {
  return git(root, ['status', '--porcelain']).then((o) => o.length > 0).catch(() => false)
}
