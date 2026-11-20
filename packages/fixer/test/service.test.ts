import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { FixEvent, FixRun, FixService } from '@perfagent/engine'
import { describe, expect, it } from 'vitest'

import { createFixService } from '../src/index.js'

import { currentBranch, makeRepo, request, stubAi, type Repo } from './fixture.js'

const FORBIDDEN = ['push', 'merge', 'rebase', 'tag', 'fetch', 'pull']

async function finished(fix: FixService, run: FixRun): Promise<FixRun> {
  return fix.wait ? fix.wait(run.id) : run
}

function assertNoRemoteGit(repo: Repo): void {
  for (const args of repo.gitLog) expect(FORBIDDEN).not.toContain(args[0])
}

describe('createFixService', () => {
  it('creates a perfagent/fix-<date> branch from main and applies a built-in fix without AI', async () => {
    const repo = await makeRepo()
    const ai = stubAi()
    const fix = createFixService({ config: repo.config, store: repo.store, ai, git: repo.git })
    const events: FixEvent[] = []
    const run = await finished(
      fix,
      await fix.start(request(repo, repo.heroIssue), (e) => events.push(e)),
    )
    expect(run.status).toBe('done')
    expect(run.branch).toMatch(/^perfagent\/fix-\d{4}-\d{2}-\d{2}$/)
    expect(await currentBranch(repo.root)).toBe(run.branch)
    expect(ai.calls).toBe(0)
    expect(events.map((e) => e.type)).toEqual(['round', 'proposal', 'applied', 'check', 'done'])
    const hero = await readFile(path.join(repo.root, 'src/components/HeroBanner.tsx'), 'utf8')
    expect(hero).toContain('fetchpriority="high"')
    expect(hero).not.toContain('loading="lazy"')
    const saved = await repo.store.get(repo.report.id)
    expect(saved.issues.find((i) => i.id === repo.heroIssue.id)?.status).toBe('fixed')
    const done = events.find((e) => e.type === 'done')
    expect(done?.type === 'done' && done.summary).toMatchObject({
      applied: 1,
      rolledBack: 0,
      branch: run.branch,
    })
    expect(fix.list()).toHaveLength(1)
    expect(JSON.stringify(await repo.store.readJson('fix-runs.json', []))).toContain(run.id)
    assertNoRemoteGit(repo)
  })

  it('refuses a dirty working tree unless stashFirst, and restores the stash on undo', async () => {
    const repo = await makeRepo()
    await writeFile(path.join(repo.root, 'wip.txt'), 'unsaved work')
    const fix = createFixService({
      config: repo.config,
      store: repo.store,
      ai: stubAi(),
      git: repo.git,
    })
    const refused = await fix.start(request(repo, repo.heroIssue), () => undefined)
    expect(refused.status).toBe('failed')
    expect(refused.events[0]).toMatchObject({
      type: 'error',
      message: expect.stringContaining('uncommitted changes'),
    })

    const run = await finished(
      fix,
      await fix.start(request(repo, repo.heroIssue, { stashFirst: true }), () => undefined),
    )
    expect(run.status).toBe('done')
    expect(repo.gitLog.some((a) => a[0] === 'stash' && a[1] === 'push')).toBe(true)
    const undone = await fix.undo(run.id)
    expect(undone.status).toBe('undone')
    expect(await readFile(path.join(repo.root, 'wip.txt'), 'utf8')).toBe('unsaved work')
    expect(await readFile(path.join(repo.root, 'src/components/HeroBanner.tsx'), 'utf8')).toContain(
      'loading="lazy"',
    )
    assertNoRemoteGit(repo)
  })

  it('rejects changes to protected globs, files outside the root and secrets', async () => {
    const repo = await makeRepo({ configOverrides: { protected: ['src/payments/**'] } })
    const ai = stubAi(() => [
      {
        file: 'src/payments/pay.ts',
        before: 'fee = 1',
        after: 'fee = 0',
        explanation: 'protected',
      },
      { file: '../outside.ts', before: 'x', after: 'y', explanation: 'outside' },
      { file: '.env', before: 'SECRET', after: 'LEAK', explanation: 'secret' },
    ])
    const fix = createFixService({ config: repo.config, store: repo.store, ai, git: repo.git })
    const events: FixEvent[] = []
    const run = await finished(
      fix,
      await fix.start(request(repo, repo.aiIssue), (e) => events.push(e)),
    )
    expect(run.status).toBe('done')
    expect(ai.calls).toBe(1)
    const rejected = events
      .filter((e) => e.type === 'error')
      .map((e) => (e.type === 'error' ? e.message : ''))
    expect(rejected).toHaveLength(3)
    expect(rejected[0]).toContain('protected')
    expect(rejected[1]).toContain('outside the project')
    expect(rejected[2]).toContain('protected file')
    expect(events.some((e) => e.type === 'applied')).toBe(false)
    expect(await readFile(path.join(repo.root, 'src/payments/pay.ts'), 'utf8')).toBe(
      'export const fee = 1\n',
    )
    expect(await readFile(path.join(repo.root, '.env'), 'utf8')).toBe('SECRET=do-not-touch\n')
  })

  it('waits for review, applies accepted changes with edits and drops skipped ones', async () => {
    const repo = await makeRepo({ configOverrides: { review: true } })
    const ai = stubAi(() => [
      { file: 'src/a.ts', before: 'const a = 1', after: 'const a = 10', explanation: 'one' },
      { file: 'src/a.ts', before: 'const b = 2', after: 'const b = 20', explanation: 'two' },
    ])
    const fix = createFixService({ config: repo.config, store: repo.store, ai, git: repo.git })
    const run = await finished(fix, await fix.start(request(repo, repo.aiIssue), () => undefined))
    expect(run.status).toBe('waiting-review')
    expect(run.pending).toHaveLength(2)
    const [first, second] = run.pending
    await fix.skip(run.id, [second?.changeId ?? ''])
    const accepted = await fix.accept(run.id, [first?.changeId ?? ''], {
      [first?.changeId ?? '']: 'const a = 42',
    })
    await finished(fix, accepted)
    const text = await readFile(path.join(repo.root, 'src/a.ts'), 'utf8')
    expect(text).toBe('export const a = 42\r\nexport const b = 2\r\n')
    expect(fix.get(run.id)?.status).toBe('done')
  })

  it('rolls back a change when the project tests fail and undo restores exact bytes', async () => {
    const repo = await makeRepo({ testPasses: false })
    const original = await readFile(path.join(repo.root, 'src/a.ts'))
    let call = 0
    const ai = stubAi(() =>
      ++call === 1
        ? [{ file: 'src/a.ts', before: 'const a = 1', after: 'const a = 99', explanation: 'break' }]
        : [
            {
              file: 'src/a.ts',
              before: 'const b = 2',
              after: 'const b = 3',
              explanation: 'repair',
            },
          ],
    )
    const fix = createFixService({ config: repo.config, store: repo.store, ai, git: repo.git })
    const events: FixEvent[] = []
    const run = await finished(
      fix,
      await fix.start(request(repo, repo.aiIssue), (e) => events.push(e)),
    )
    expect(run.status).toBe('done')
    expect(events.map((e) => e.type)).toEqual([
      'round',
      'proposal',
      'applied',
      'check',
      'check',
      'rolled-back',
      'done',
    ])
    expect(events.filter((e) => e.type === 'check').every((e) => e.type === 'check' && !e.ok)).toBe(
      true,
    )
    expect(ai.calls).toBe(2) // proposal + one repair attempt
    expect(Buffer.compare(await readFile(path.join(repo.root, 'src/a.ts')), original)).toBe(0)
    const done = events.at(-1)
    expect(done?.type === 'done' && done.summary.rolledBack).toBe(1)
    await fix.undo(run.id)
    expect(Buffer.compare(await readFile(path.join(repo.root, 'src/a.ts')), original)).toBe(0)
    assertNoRemoteGit(repo)
  })

  it('commits on the fix branch only when autoCommit is on, and never pushes', async () => {
    const repo = await makeRepo({ configOverrides: { autoCommit: true } })
    const fix = createFixService({
      config: repo.config,
      store: repo.store,
      ai: stubAi(),
      git: repo.git,
    })
    const run = await finished(fix, await fix.start(request(repo, repo.heroIssue), () => undefined))
    expect(run.status).toBe('done')
    const commit = repo.gitLog.find((a) => a[0] === 'commit')
    expect(commit?.[2]).toBe(`perf: ${repo.heroIssue.title} (perfagent)`)
    expect(await currentBranch(repo.root)).toBe(run.branch)
    assertNoRemoteGit(repo)
  })

  it('selects issues by chip and route scope and stops at maxRounds', async () => {
    const repo = await makeRepo({ configOverrides: { maxRounds: 1 } })
    const fix = createFixService({
      config: repo.config,
      store: repo.store,
      ai: stubAi(),
      git: repo.git,
    })
    const run = await finished(
      fix,
      await fix.start(
        { reportId: repo.report.id, scope: { kind: 'chip', chip: 'metric:lcp' } },
        () => undefined,
      ),
    )
    expect(run.events.filter((e) => e.type === 'round')).toHaveLength(1)
    expect(run.events[0]).toMatchObject({ type: 'round', issueId: repo.heroIssue.id })
  })
})
