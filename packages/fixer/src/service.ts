import { readFile } from 'node:fs/promises'

import type { PerfAgentConfig } from '@perfagent/config'
import { PerfAgentError, metricValue, shortId, type Issue, type Report } from '@perfagent/core'
import { gatherContext, git as engineGit, isGitRepo, isWorkingTreeDirty, retestIssue, type AiService, type FixEvent, type FixRun, type FixService, type FixSummary, type ProposedChange, type ReportStore } from '@perfagent/engine'

import { runChecks } from './checks.js'
import { applyChange, isRejected, restore, vetChange, type Backups } from './files.js'
import { selectIssues } from './scope.js'

export interface FixServiceOptions {
  config: PerfAgentConfig
  store: ReportStore
  ai: AiService
  /** Git runner; tests inject a spy to prove nothing is ever pushed. */
  git?: typeof engineGit
}

const MAX_RUNS = 20
const RUNS_FILE = 'fix-runs.json'
const VERIFY_TOLERANCE = 1.15

interface Pending {
  changeId: string
  issueId: string
  change: ProposedChange
}

/** Everything a run needs beyond the public FixRun shape. */
interface RunState {
  run: FixRun
  report: Report
  queue: Issue[]
  backups: Backups
  touched: Set<string>
  stashed: boolean
  onEvent: (event: FixEvent) => void
  counts: { applied: number; skipped: number; rolledBack: number }
  costStartUsd: number
  after?: number
  waiters: ((run: FixRun) => void)[]
}

export function createFixService(options: FixServiceOptions): FixService {
  const { config, store, ai } = options
  const git = options.git ?? engineGit
  const root = config.root
  const states = new Map<string, RunState>()

  function emit(state: RunState, event: FixEvent): void {
    state.run.events.push(event)
    try {
      state.onEvent(event)
    } catch {
      // A broken listener must not stop the run.
    }
    void persist()
  }

  function persist(): Promise<void> {
    return store.writeJson(RUNS_FILE, [...states.values()].map((s) => s.run)).catch(() => undefined)
  }

  function settle(state: RunState, status: FixRun['status']): void {
    state.run.status = status
    for (const w of state.waiters.splice(0)) w(state.run)
    void persist()
  }

  async function spentUsd(state: RunState): Promise<number> {
    return Math.max(0, (await ai.usage()).monthUsd - state.costStartUsd)
  }

  async function preflight(state: RunState): Promise<boolean> {
    if (!(await isGitRepo(root))) {
      emit(state, { type: 'error', message: `${root} is not a git repository. Fixes need git so every change can be undone.` })
      return false
    }
    if (await isWorkingTreeDirty(root)) {
      if (!state.run.request.stashFirst) {
        emit(state, { type: 'error', message: 'Working tree has uncommitted changes. Commit or stash them first, or start the run with stashFirst.' })
        return false
      }
      await git(root, ['stash', 'push', '-m', 'perfagent'])
      state.stashed = true
    }
    const current = await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
    state.run.branch = current.startsWith('perfagent/fix-') ? current : await createFixBranch()
    return true
  }

  async function createFixBranch(): Promise<string> {
    const base = `perfagent/fix-${new Date().toISOString().slice(0, 10)}`
    const existing = (await git(root, ['branch', '--list', `${base}*`])).split('\n').map((b) => b.replace(/^[*+ ]+/, '').trim())
    let name = base
    for (let n = 2; existing.includes(name); n++) name = `${base}-${n}`
    await git(root, ['switch', '-c', name])
    return name
  }

  async function proposalsFor(state: RunState, issue: Issue): Promise<ProposedChange[]> {
    const builtIn = issue.fix.changes.filter((c) => c.before)
    if (issue.fix.automatic && builtIn.length) {
      const applicable = await Promise.all(builtIn.map(async (c) => ({ c, ok: await containsBefore(c.file, c.before) })))
      if (applicable.every((a) => a.ok)) return builtIn.map((c) => ({ ...c, explanation: issue.fix.steps[0] ?? issue.title }))
    }
    if ((await ai.activeProvider()) === 'rules') return []
    if ((await spentUsd(state)) >= config.fix.maxCostUsd) {
      emit(state, { type: 'error', message: `AI cost limit of $${config.fix.maxCostUsd} reached; stopping.` })
      state.queue.length = 0
      return []
    }
    const files = await gatherContext(root, [issue], config.ai.sendCode)
    return files.length ? ai.proposeFix([issue], files) : []
  }

  async function containsBefore(file: string, before: string): Promise<boolean> {
    const guarded = await vetChange(root, { file, before, after: '' }, config.fix.protected)
    if (isRejected(guarded)) return false
    return (await readFile(guarded.absolute, 'utf8').catch(() => '')).includes(before)
  }

  /** Runs rounds until the queue, the limits or the target say stop; pauses when a review is needed. */
  async function loop(state: RunState): Promise<void> {
    const { run } = state
    const limits = config.fix
    try {
      while (run.status === 'running') {
        const rounds = run.events.filter((e) => e.type === 'round').length
        if (rounds >= limits.maxRounds || state.touched.size >= limits.maxFiles || targetReached(state)) break
        const issue = state.queue.shift()
        if (!issue) break
        emit(state, { type: 'round', round: rounds + 1, issueId: issue.id, message: `Fixing: ${issue.title}` })
        const proposals = await proposalsFor(state, issue)
        const pending: Pending[] = []
        for (const change of proposals) {
          const vetted = await vetChange(root, change, limits.protected)
          if (isRejected(vetted)) {
            emit(state, { type: 'error', message: `Rejected change: ${vetted.reason}` })
            continue
          }
          const entry = { changeId: shortId('chg'), issueId: issue.id, change }
          pending.push(entry)
          emit(state, { type: 'proposal', ...entry })
        }
        if (!pending.length) {
          state.counts.skipped++
          continue
        }
        if (run.request.review ?? limits.review) {
          run.pending = pending
          settle(state, 'waiting-review')
          return
        }
        await applyRound(state, issue, pending)
      }
      finish(state)
    } catch (error) {
      emit(state, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      settle(state, 'failed')
    }
  }

  async function applyRound(state: RunState, issue: Issue, pending: Pending[]): Promise<void> {
    const roundFiles = new Set<string>()
    for (const { changeId, change } of pending) {
      const vetted = await vetChange(root, change, config.fix.protected)
      if (isRejected(vetted)) continue
      try {
        await applyChange(vetted.absolute, vetted.relative, change, state.backups)
      } catch (error) {
        emit(state, { type: 'rolled-back', changeId, reason: error instanceof Error ? error.message : 'could not apply' })
        state.counts.rolledBack++
        continue
      }
      roundFiles.add(vetted.relative)
      state.touched.add(vetted.relative)
      emit(state, { type: 'applied', changeId, file: vetted.relative })
    }
    if (!roundFiles.size) return
    let ok = await checks(state)
    if (!ok) ok = await repair(state, issue, roundFiles)
    if (!ok) {
      await restore(root, state.backups, roundFiles)
      for (const { changeId } of pending) emit(state, { type: 'rolled-back', changeId, reason: 'Project checks failed after the change' })
      for (const f of roundFiles) state.touched.delete(f)
      state.counts.rolledBack += pending.length
      return
    }
    state.counts.applied += pending.length
    const verified = await retest(state, issue)
    if (verified) await store.updateIssue(state.report.id, issue.id, { status: 'fixed' }).catch(() => undefined)
    if (state.run.request.autoCommit ?? config.fix.autoCommit) {
      await git(root, ['add', '--', ...roundFiles])
      await git(root, ['commit', '-m', `perf: ${issue.title} (perfagent)`])
    }
  }

  async function checks(state: RunState): Promise<boolean> {
    const results = await runChecks(root, config.fix)
    for (const r of results) emit(state, { type: 'check', name: r.name, ok: r.ok, output: r.output })
    return results.every((r) => r.ok)
  }

  /** One AI repair attempt with the failing output; falls back to rollback. */
  async function repair(state: RunState, issue: Issue, files: Set<string>): Promise<boolean> {
    if ((await ai.activeProvider()) === 'rules' || (await spentUsd(state)) >= config.fix.maxCostUsd) return false
    const failed = [...state.run.events].reverse().find((e) => e.type === 'check' && !e.ok)
    const output = failed?.type === 'check' ? failed.output : ''
    const context = await gatherContext(root, [...files].map((file) => ({ ...issue, location: { file, line: 1 } })), 'files')
    const changes = await ai.proposeFix([issue], context, `The project checks failed after your change. Repair it. Output:\n${output}`).catch(() => [])
    const applied: string[] = []
    for (const change of changes) {
      const vetted = await vetChange(root, change, config.fix.protected)
      if (isRejected(vetted)) continue
      await applyChange(vetted.absolute, vetted.relative, change, state.backups).then(() => applied.push(vetted.relative), () => undefined)
      files.add(vetted.relative)
      state.touched.add(vetted.relative)
    }
    return applied.length ? checks(state) : false
  }

  /** Re-measures the page when there is one to measure; otherwise the passing checks count as verification. */
  async function retest(state: RunState, issue: Issue): Promise<boolean> {
    const page = state.report.pages.find((p) => p.route === issue.route) ?? state.report.pages[0]
    if (!page || !config.urls.length) return true
    try {
      const result = await retestIssue(state.report, issue, { config })
      const actual = result.issue.verified?.actual ?? issue.gain.from
      emit(state, { type: 'retest', issueId: issue.id, predicted: issue.gain.to, actual })
      await store.updateIssue(state.report.id, issue.id, { verified: result.issue.verified })
      state.after = metricValue(result.page.metrics, 'score') ?? state.after
      return actual <= issue.gain.to * VERIFY_TOLERANCE
    } catch {
      return true
    }
  }

  function targetReached(state: RunState): boolean {
    const target = state.run.request.target ?? config.fix.target
    return target.score !== undefined && state.after !== undefined && state.after >= target.score
  }

  function finish(state: RunState): void {
    const before = averageScore(state.report)
    const summary: FixSummary = { branch: state.run.branch, rounds: state.run.events.filter((e) => e.type === 'round').length, ...state.counts, costUsd: 0, before, after: state.after ?? before }
    void spentUsd(state).then((cost) => {
      summary.costUsd = cost
      emit(state, { type: 'done', summary })
      settle(state, 'done')
    })
  }

  function stateOf(id: string): RunState {
    const state = states.get(id)
    if (!state) throw new PerfAgentError('NOT_FOUND', 'Fix run not found')
    return state
  }

  return {
    async start(request, onEvent) {
      const run: FixRun = { id: shortId('fix'), request, branch: '', status: 'running', events: [], pending: [], startedAt: new Date().toISOString() }
      const report = await store.get(request.reportId)
      const state: RunState = { run, report, queue: selectIssues(report, request.scope), backups: new Map(), touched: new Set(), stashed: false, onEvent, counts: { applied: 0, skipped: 0, rolledBack: 0 }, costStartUsd: (await ai.usage()).monthUsd, waiters: [] }
      states.set(run.id, state)
      for (const old of [...states.keys()].slice(0, Math.max(0, states.size - MAX_RUNS))) states.delete(old)
      if (!(await preflight(state).catch((error: unknown) => { emit(state, { type: 'error', message: error instanceof Error ? error.message : String(error) }); return false }))) {
        settle(state, 'failed')
        return run
      }
      // The loop continues after start() returns; events arrive through onEvent and wait().
      void loop(state)
      return run
    },
    get: (id) => states.get(id)?.run,
    list: () => [...states.values()].map((s) => s.run),
    async accept(id, changeIds, edits = {}) {
      const state = stateOf(id)
      if (state.run.status !== 'waiting-review') throw new PerfAgentError('FIX_REJECTED', 'This run is not waiting for review')
      const chosen = state.run.pending.filter((p) => changeIds.includes(p.changeId)).map((p) => ({ ...p, change: { ...p.change, after: edits[p.changeId] ?? p.change.after } }))
      state.run.pending = state.run.pending.filter((p) => !changeIds.includes(p.changeId))
      const issue = state.report.issues.find((i) => i.id === chosen[0]?.issueId)
      if (issue && chosen.length) await applyRound(state, issue, chosen)
      if (!state.run.pending.length) {
        state.run.status = 'running'
        void loop(state)
      }
      return state.run
    },
    skip(id, changeIds) {
      const state = stateOf(id)
      state.run.pending = state.run.pending.filter((p) => !changeIds.includes(p.changeId))
      state.counts.skipped += changeIds.length
      if (!state.run.pending.length && state.run.status === 'waiting-review') {
        state.run.status = 'running'
        void loop(state)
      }
      return Promise.resolve(state.run)
    },
    async undo(id) {
      const state = stateOf(id)
      await restore(root, state.backups)
      if (state.stashed) await git(root, ['stash', 'pop']).catch(() => undefined)
      state.stashed = false
      settle(state, 'undone')
      return state.run
    },
    wait(id) {
      const state = stateOf(id)
      if (state.run.status !== 'running') return Promise.resolve(state.run)
      return new Promise((resolve) => state.waiters.push(resolve))
    },
  }
}

function averageScore(report: Report): number {
  const scores = report.pages.map((p) => metricValue(p.metrics, 'score') ?? 0)
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
}
